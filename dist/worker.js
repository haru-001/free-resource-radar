// 免费资源雷达 · 单文件版（v1.8.2）：可直接粘贴到 Cloudflare 控制台的在线编辑器。需要绑定 D1（DB），KV（SECRETS）可选，并添加 Cron 触发器 * * * * *
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
          const line2 = this.buf.slice(pos, nl).replace(/\r$/, "");
          if (/^\d{3}( |$)/.test(line2)) return nl + 1;
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
      async cmd(line2, expect, step) {
        await this.write(line2 + "\r\n");
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

// src/categories.js
var CATEGORIES = [
  { key: "domain", label: "\u514D\u8D39\u57DF\u540D", color: "#4f46e5", kw: ["\u57DF\u540D", "\u4E8C\u7EA7\u57DF\u540D", "\u5B50\u57DF\u540D", "domain", "subdomain", "dns", ".eu.org", ".us.kg"], q: ["\u514D\u8D39\u57DF\u540D \u6CE8\u518C", "\u514D\u8D39\u4E8C\u7EA7\u57DF\u540D"] },
  { key: "hosting", label: "\u4E3B\u673A / VPS", color: "#0891b2", kw: ["\u4E3B\u673A", "\u865A\u62DF\u4E3B\u673A", "\u7A7A\u95F4", "vps", "\u670D\u52A1\u5668", "\u5EFA\u7AD9", "hosting", "webhost", "web host", "cpanel", "server", "\u5C0F\u9E21"], q: ["\u514D\u8D39\u865A\u62DF\u4E3B\u673A", "\u514D\u8D39 VPS \u670D\u52A1\u5668"] },
  { key: "cloud", label: "\u4E91\u670D\u52A1 / CDN", color: "#0284c7", kw: ["\u4E91\u670D\u52A1", "\u4E91\u51FD\u6570", "serverless", "cdn", "\u5BF9\u8C61\u5B58\u50A8", "s3", "\u6570\u636E\u5E93", "database", "cloud", "pages", "workers", "\u6258\u7BA1", "deploy", "paas"], q: ["\u514D\u8D39\u4E91\u670D\u52A1 \u989D\u5EA6", "\u514D\u8D39 CDN \u5BF9\u8C61\u5B58\u50A8"] },
  { key: "ai", label: "AI \u514D\u8D39\u989D\u5EA6", group: "aifree", color: "#7c3aed", kw: ["ai", "gpt", "claude", "gemini", "llm", "\u5927\u6A21\u578B", "api key", "token", "\u989D\u5EA6", "\u6A21\u578B", "openrouter", "deepseek", "copilot", "cursor", "\u514D\u8D39\u6A21\u578B", "\u514D\u8D39\u5C42", "free tier"], q: ["\u514D\u8D39 AI API \u989D\u5EA6", "\u5927\u6A21\u578B \u514D\u8D39 token"] },
  // AI 限时福利：限时免费开放、注册送额度、优惠码 / 免费月、公益站签到，时效强，单独成类
  { key: "aideal", label: "AI \u9650\u65F6\u798F\u5229", group: "aifree", color: "#c026d3", need: /(^|[^a-z])(ai|api|gpt|llm|agent|token)([^a-z]|$)|claude|gemini|deepseek|qwen|kimi|glm|grok|openai|anthropic|cursor|copilot|大模型|模型|智能体|算力|生图|编程助手/i, kw: ["\u9650\u65F6\u514D\u8D39", "\u514D\u8D39\u5F00\u653E", "\u9001\u989D\u5EA6", "\u6CE8\u518C\u9001", "\u8D60\u91D1", "\u8D60\u9001", "\u514D\u8D39\u9886", "\u514D\u8D39\u4E00\u4E2A\u6708", "\u514D\u8D39\u8BD5\u7528", "\u4F18\u60E0\u7801", "\u5151\u6362\u7801", "\u516C\u76CA\u7AD9", "\u4E2D\u8F6C\u7AD9", "new api", "\u7B7E\u5230", "\u798F\u5229", "free credits", "free month"], q: ["AI \u9650\u65F6\u514D\u8D39 \u9001\u989D\u5EA6", "AI \u516C\u76CA\u7AD9 \u6CE8\u518C\u9001\u989D\u5EA6"] },
  { key: "aitool", label: "AI \u5DE5\u5177", group: "ai", color: "#a21caf", kw: ["ai \u5DE5\u5177", "ai\u5DE5\u5177", "agent", "\u667A\u80FD\u4F53", "ai \u7ED8\u753B", "ai\u7ED8\u56FE", "\u751F\u56FE", "ai \u5199\u4F5C", "chatgpt \u955C\u50CF", "\u955C\u50CF\u7AD9", "mcp", "ai \u52A9\u624B", "ai\u52A9\u624B", "\u63D2\u4EF6"], q: ["\u514D\u8D39 AI \u5DE5\u5177 \u63A8\u8350"] },
  { key: "software", label: "\u8F6F\u4EF6\u6388\u6743", color: "#db2777", kw: ["\u6FC0\u6D3B\u7801", "\u6388\u6743", "\u6CE8\u518C\u7801", "\u8BB8\u53EF\u8BC1", "license", "giveaway", "\u9650\u514D", "\u6B63\u7248", "pro \u7248", "\u4F1A\u5458\u7248", "lifetime"], q: ["\u6B63\u7248\u8F6F\u4EF6 \u9650\u514D", "\u8F6F\u4EF6 \u6FC0\u6D3B\u7801 \u514D\u8D39\u9886\u53D6"] },
  { key: "dev", label: "\u5F00\u53D1\u5DE5\u5177", color: "#475569", kw: ["\u5F00\u53D1\u8005", "developer", "ide", "github", "api", "sdk", "ci", "\u76D1\u63A7", "\u90AE\u7BB1\u670D\u52A1", "smtp", "free tier", "free plan"], q: ["\u5F00\u53D1\u8005 \u514D\u8D39\u5957\u9910", "free tier for developers"] },
  { key: "game", label: "\u6E38\u620F", color: "#16a34a", kw: ["\u6E38\u620F", "steam", "epic", "gog", "game", "\u559C\u52A0\u4E00", "dlc"], q: ["\u559C\u52A0\u4E00 \u514D\u8D39\u9886\u53D6"] },
  { key: "media", label: "\u5F71\u97F3\u4F1A\u5458", color: "#e11d48", kw: ["\u4F1A\u5458", "\u89C6\u9891", "\u97F3\u4E50", "\u5F71\u89C6", "vip", "spotify", "youtube", "netflix", "\u7535\u5B50\u4E66", "kindle"], q: ["\u514D\u8D39\u4F1A\u5458 \u9886\u53D6"] },
  { key: "design", label: "\u8BBE\u8BA1\u7D20\u6750", color: "#ea580c", kw: ["\u5B57\u4F53", "\u7D20\u6750", "\u56FE\u6807", "\u6A21\u677F", "font", "icon", "template", "figma", "psd"], q: ["\u514D\u8D39\u5546\u7528 \u5B57\u4F53 \u7D20\u6750"] },
  { key: "edu", label: "\u5B66\u751F / \u6559\u80B2", color: "#ca8a04", kw: ["\u5B66\u751F", "\u6559\u80B2", "edu", "student", "\u5B66\u672F", "\u6821\u56ED"], q: ["\u5B66\u751F \u514D\u8D39 \u6743\u76CA"] },
  { key: "course", label: "\u7F51\u8BFE\u6559\u7A0B", color: "#65a30d", kw: ["\u8BFE\u7A0B", "\u7F51\u8BFE", "\u6559\u7A0B", "course", "udemy", "coursera", "\u8BAD\u7EC3\u8425"], q: ["\u9650\u65F6\u514D\u8D39 \u8BFE\u7A0B"] },
  { key: "pan", label: "\u7F51\u76D8\u8D44\u6E90", color: "#0d9488", kw: ["\u7F51\u76D8", "\u4E91\u76D8", "\u963F\u91CC\u4E91\u76D8", "\u767E\u5EA6\u7F51\u76D8", "\u5938\u514B", "\u5206\u4EAB\u94FE\u63A5", "\u8D44\u6E90\u5408\u96C6"], q: [] },
  { key: "goods", label: "\u5B9E\u7269\u798F\u5229", color: "#dc2626", kw: ["\u5305\u90AE", "\u5B9E\u7269", "\u5468\u8FB9", "0\u5143\u8D2D", "\u514D\u8D39\u9001", "\u8D60\u9001", "\u8D34\u7EB8", "swag"], q: [] },
  { key: "invite", label: "\u9080\u8BF7\u7801", color: "#9333ea", kw: ["\u9080\u8BF7\u7801", "\u9080\u8BF7\u94FE\u63A5", "invite", "\u5185\u6D4B\u8D44\u683C", "beta"], q: [] },
  // 资讯与梯子：不是“白嫖资源”，不要求出现“免费”字样，一般由专源直接收录
  { key: "ainews", label: "AI \u8D44\u8BAF", group: "ai", info: true, color: "#6d28d9", kw: ["\u53D1\u5E03", "\u4E0A\u7EBF", "\u5F00\u6E90", "\u5927\u6A21\u578B", "\u6A21\u578B", "openai", "anthropic", "gemini", "deepseek", "\u667A\u80FD\u4F53"], q: [] },
  { key: "news", label: "\u79D1\u6280\u8D44\u8BAF", group: "news", info: true, color: "#2563eb", kw: ["\u53D1\u5E03", "\u5BA3\u5E03", "\u6D88\u606F", "\u62A5\u9053", "\u8D22\u62A5", "\u65B0\u54C1", "\u66F4\u65B0"], q: [] },
  { key: "proxy", label: "\u68AF\u5B50\u8BA2\u9605", group: "proxy", info: true, color: "#0f766e", kw: ["\u8282\u70B9", "\u8BA2\u9605", "v2ray", "clash", "vless", "trojan", "shadowsocks", "\u673A\u573A", "\u79D1\u5B66\u4E0A\u7F51", "\u68AF\u5B50"], q: [] },
  { key: "other", label: "\u5176\u5B83", color: "#9ca3af", kw: [], q: [] }
];
for (const c of CATEGORIES) c.group ||= "fuli";
var CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
var GROUPS = [
  { key: "fuli", label: "\u798F\u5229\u7F8A\u6BDB", icon: "\u7F8A" },
  { key: "aifree", label: "AI \u798F\u5229", icon: "\u60E0" },
  { key: "ai", label: "AI \u5DE5\u5177\u4E0E\u8D44\u8BAF", icon: "AI" },
  { key: "news", label: "\u65B0\u95FB\u8D44\u8BAF", icon: "\u8BAF" },
  { key: "proxy", label: "\u514D\u8D39\u68AF\u5B50", icon: "\u68AF" }
];
var isInfoCat = (k) => !!CAT_MAP[k]?.info;
var DEFAULT_ENABLED = ["domain", "hosting", "cloud", "ai", "aideal", "aitool", "software", "dev", "game", "edu", "ainews", "news", "proxy"];
function enabledCats(s) {
  const list = String(s.enabled_categories || "").split(/[,\s]+/).filter((k) => CAT_MAP[k]);
  return list.length ? list : DEFAULT_ENABLED;
}
function mailCats(s) {
  const list = String(s.mail_categories || "").split(/[,\s]+/).filter((k) => CAT_MAP[k]);
  return list.length ? list : enabledCats(s);
}
var reCache = /* @__PURE__ */ new Map();
function kwHit(text, w) {
  if (/^[a-z0-9.\- ]{1,4}$/.test(w)) {
    let re = reCache.get(w);
    if (!re) {
      re = new RegExp(`(^|[^a-z0-9])${w.replace(/[.\-]/g, "\\$&")}($|[^a-z0-9])`);
      reCache.set(w, re);
    }
    return re.test(text);
  }
  return text.includes(w);
}
function compileWords(words) {
  const esc2 = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = [...new Set(words.filter(Boolean))].map((w) => /^[a-z0-9.\- ]{1,4}$/.test(w) ? `(?:^|[^a-z0-9])${esc2(w)}(?:$|[^a-z0-9])` : esc2(w));
  return parts.length ? new RegExp(parts.join("|")) : null;
}
function guessCategory(text, enabled) {
  const t = String(text || "").toLowerCase();
  let best = null, bestN = 0;
  for (const k of enabled) {
    if (CAT_MAP[k]?.need && !CAT_MAP[k].need.test(t)) continue;
    const n = (CAT_MAP[k]?.kw || []).reduce((a, w) => a + (kwHit(t, w) ? 1 : 0), 0);
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}
function topicWordsFor(enabled) {
  return [...new Set(enabled.flatMap((k) => CAT_MAP[k]?.kw || []))];
}
function searchQueriesFor(enabled) {
  return enabled.flatMap((k) => CAT_MAP[k]?.q || []);
}

// src/push.js
var CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
var OBTAIN_ZH = { free: "\u76F4\u63A5\u767D\u5AD6", conditional: "\u6709\u6761\u4EF6", lottery: "\u62BD\u5956", trial: "\u8BD5\u7528", promo: "\u63A8\u5E7F", paid: "\u9700\u4ED8\u8D39" };
var PUSH_CHANNELS = [
  { id: "wecom", name: "\u4F01\u4E1A\u5FAE\u4FE1\u673A\u5668\u4EBA", key: "wecom_webhook", hint: "\u7FA4\u673A\u5668\u4EBA\u7684 Webhook \u5730\u5740\uFF08https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=\u2026\uFF09" },
  { id: "dingtalk", name: "\u9489\u9489\u673A\u5668\u4EBA", key: "dingtalk_webhook", secret: "dingtalk_secret", hint: "\u81EA\u5B9A\u4E49\u673A\u5668\u4EBA\u7684 Webhook \u5730\u5740\uFF1B\u5B89\u5168\u8BBE\u7F6E\u9009\u300C\u52A0\u7B7E\u300D\u65F6\u628A\u5BC6\u94A5\u586B\u5230\u4E0B\u9762\uFF0C\u9009\u300C\u81EA\u5B9A\u4E49\u5173\u952E\u8BCD\u300D\u65F6\u5173\u952E\u8BCD\u586B\uFF1A\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE" },
  { id: "feishu", name: "\u98DE\u4E66\u673A\u5668\u4EBA", key: "feishu_webhook", secret: "feishu_secret", hint: "\u81EA\u5B9A\u4E49\u673A\u5668\u4EBA\u7684 Webhook \u5730\u5740\uFF1B\u5F00\u4E86\u7B7E\u540D\u6821\u9A8C\u5C31\u628A\u5BC6\u94A5\u586B\u5230\u4E0B\u9762" },
  { id: "serverchan", name: "Server \u9171\uFF08\u5FAE\u4FE1\uFF09", key: "serverchan_key", hint: "SendKey\uFF08sct.ftqq.com \u6216 Server \u9171\xB3 \u7684 sctp \u5F00\u5934\u7684 Key\uFF09" },
  { id: "pushplus", name: "PushPlus\uFF08\u5FAE\u4FE1\uFF09", key: "pushplus_token", hint: "pushplus.plus \u7684 token" },
  { id: "bark", name: "Bark\uFF08iPhone\uFF09", key: "bark_url", hint: "Bark App \u91CC\u590D\u5236\u7684\u5730\u5740\uFF0C\u5982 https://api.day.app/\u4F60\u7684Key" },
  { id: "webhook", name: "\u901A\u7528 Webhook", key: "webhook_url", hint: "POST JSON\uFF1A{title, text, items:[{title,url,summary,category}]}\uFF0C\u53EF\u63A5 n8n / \u81EA\u5EFA\u670D\u52A1" }
];
var PUSH_KEYS = PUSH_CHANNELS.flatMap((c) => [c.key, c.secret].filter(Boolean));
var pushReady = (s, c) => !!String(s[c.key] || "").trim() && s[`${c.id}_enabled`] !== "false";
var line = (it) => {
  const tags = [CAT[it.category] || "", it.obtain && OBTAIN_ZH[it.obtain] && it.obtain !== "free" ? OBTAIN_ZH[it.obtain] : "", it.expires_at ? "\u622A\u6B62 " + new Date(it.expires_at + 8 * 36e5).toISOString().slice(5, 10) : ""].filter(Boolean).join(" \xB7 ");
  return { name: String(it.name || it.title).slice(0, 80), url: it.url, summary: String(it.summary || "").slice(0, 90), tags };
};
function markdown(title, items, max, siteUrl) {
  let out = `### ${title}
`;
  let n = 0;
  for (const it of items) {
    const l = line(it);
    const block = `
- [${l.name.replace(/[[\]]/g, "")}](${l.url})${l.summary ? `
  ${l.summary}` : ""}${l.tags ? `
  <font color="comment">${l.tags}</font>` : ""}`;
    if (new TextEncoder().encode(out + block).length > max - 200) break;
    out += block;
    n++;
  }
  if (n < items.length) out += `

\u2026\u2026\u8FD8\u6709 ${items.length - n} \u6761${siteUrl ? `\uFF0C[\u67E5\u770B\u5168\u90E8](${siteUrl})` : ""}`;
  else if (siteUrl) out += `

[\u67E5\u770B\u5168\u90E8](${siteUrl})`;
  if (!items.length) out += "\n\u4ECA\u5929\u6CA1\u6709\u65B0\u7684\u8D44\u6E90\u3002";
  return out;
}
var plain = (title, items, siteUrl) => [title, "", ...items.slice(0, 30).map((it, i) => {
  const l = line(it);
  return `${i + 1}. ${l.name}
${l.url}${l.summary ? "\n" + l.summary : ""}`;
}), items.length > 30 ? `\u2026\u2026\u8FD8\u6709 ${items.length - 30} \u6761` : "", siteUrl ? `\u67E5\u770B\u5168\u90E8\uFF1A${siteUrl}` : ""].filter((x) => x !== "").join("\n");
async function hmacB64(key, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
  return btoa(String.fromCharCode(...sig));
}
async function post(url, body, type = "json") {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": type === "json" ? "application/json" : "application/x-www-form-urlencoded" },
    body: type === "json" ? JSON.stringify(body) : new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(15e3)
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 160)}`);
  let j = {};
  try {
    j = JSON.parse(t);
  } catch {
  }
  const code = j.errcode ?? j.code ?? j.StatusCode ?? 0;
  if (code !== 0 && code !== 200 && code !== "0") throw new Error(j.errmsg || j.msg || j.message || `\u8FD4\u56DE\u7801 ${code}`);
  return j;
}
async function pushTo(id, s, title, items) {
  const c = PUSH_CHANNELS.find((x) => x.id === id);
  if (!c) throw new Error("\u672A\u77E5\u6E20\u9053");
  const v = String(s[c.key] || "").trim();
  if (!v) throw new Error(`\u672A\u586B\u5199${c.name}`);
  const site = (s.mail_site_url || "").replace(/\/+$/, "");
  switch (id) {
    case "wecom":
      return post(v, { msgtype: "markdown", markdown: { content: markdown(title, items, 4e3, site) } });
    case "dingtalk": {
      let url = v;
      if (s.dingtalk_secret) {
        const ts = Date.now();
        url += `${url.includes("?") ? "&" : "?"}timestamp=${ts}&sign=${encodeURIComponent(await hmacB64(s.dingtalk_secret, `${ts}
${s.dingtalk_secret}`))}`;
      }
      return post(url, { msgtype: "markdown", markdown: { title: `\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE \xB7 ${title}`.slice(0, 60), text: markdown(`\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE \xB7 ${title}`, items, 18e3, site) } });
    }
    case "feishu": {
      const body = { msg_type: "text", content: { text: `\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE \xB7 ${plain(title, items, site)}`.slice(0, 18e3) } };
      if (s.feishu_secret) {
        const ts = Math.floor(Date.now() / 1e3);
        body.timestamp = String(ts);
        body.sign = await hmacB64(`${ts}
${s.feishu_secret}`, "");
      }
      return post(v, body);
    }
    case "serverchan": {
      const m = /^sctp(\d+)t/i.exec(v);
      const url = m ? `https://${m[1]}.push.ft07.com/send/${v}.send` : `https://sctapi.ftqq.com/${v}.send`;
      return post(url, { title: title.slice(0, 32), desp: markdown(title, items, 3e4, site) }, "form");
    }
    case "pushplus":
      return post("https://www.pushplus.plus/send", { token: v, title: title.slice(0, 100), content: markdown(title, items, 18e3, site), template: "markdown" });
    case "bark": {
      const first = items[0];
      return post(v.replace(/\/+$/, ""), { title: title.slice(0, 60), body: items.length ? items.slice(0, 5).map((it) => "\xB7 " + (it.name || it.title)).join("\n") + (items.length > 5 ? `
\u2026\u5171 ${items.length} \u6761` : "") : "\u4ECA\u5929\u6CA1\u6709\u65B0\u7684\u8D44\u6E90", group: "\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE", url: items.length === 1 ? first.url : site || void 0 });
    }
    case "webhook":
      return post(v, { title, text: plain(title, items, site), items: items.map((it) => ({ title: it.name || it.title, url: it.url, summary: it.summary || "", category: it.category, obtain: it.obtain || null, expires_at: it.expires_at || null })) });
  }
}
async function pushAll(s, title, items, only) {
  const ok = [], errors = [];
  for (const c of PUSH_CHANNELS) {
    if (only ? c.id !== only : !pushReady(s, c)) continue;
    try {
      await pushTo(c.id, s, title, items);
      ok.push(c.name);
    } catch (e) {
      errors.push(`${c.name}\uFF1A${e.message}`);
    }
  }
  return { ok, errors };
}

// src/extras.js
var DAY = 864e5;
function rankOf(it) {
  const srcN = Array.isArray(it.srcs) ? it.srcs.length : 0;
  return (it.score ?? 70) + (it.up || 0) * 6 - (it.down || 0) * 8 + srcN * 4 + (it.obtain === "free" ? 5 : 0) + (it.expires_at ? 3 : 0) - (it.dead ? 60 : 0);
}
function weeklyPicks(items, now = Date.now(), n = 10) {
  const list = items.filter((it) => !isInfoCat(it.category) && !it.dead && !(it.extra && it.extra.subs) && now - (it.published_at || it.fetched_at || 0) <= 7 * DAY && !(it.expires_at && it.expires_at < now));
  list.sort((a, b) => rankOf(b) - rankOf(a));
  const per = {}, out = [], seen = /* @__PURE__ */ new Set();
  for (const it of list) {
    const k = String(it.name || it.title).toLowerCase().replace(/[（(【[][^)）】\]]*[)）】\]]/g, "").replace(/giveaway|免费领取|限免|epic|steam|[^\p{L}\p{N}]+/gu, "").slice(0, 24);
    if (k && seen.has(k)) continue;
    if (k) seen.add(k);
    if ((per[it.category] = (per[it.category] || 0) + 1) > 3) continue;
    out.push(it);
    if (out.length >= n) break;
  }
  return out;
}
var PERKS = [
  { name: "GitHub \u5B66\u751F\u5F00\u53D1\u8005\u5305", url: "https://education.github.com/pack", note: "\u5B66\u751F\u8BA4\u8BC1\u540E\u9001 Copilot Pro\u3001\u57DF\u540D\u3001\u4E91\u670D\u52A1\u989D\u5EA6\u7B49\u51E0\u5341\u9879\u6743\u76CA", who: "\u5B66\u751F" },
  { name: "JetBrains \u6559\u80B2\u8BB8\u53EF", url: "https://www.jetbrains.com/academy/student-pack/", note: "\u5B66\u751F\u548C\u8001\u5E08\u514D\u8D39\u7528 IntelliJ IDEA\u3001PyCharm \u7B49\u5168\u5BB6\u6876", who: "\u5B66\u751F" },
  { name: "Azure \u5B66\u751F\u7248", url: "https://azure.microsoft.com/free/students/", note: "\u5B66\u6821\u90AE\u7BB1\u8BA4\u8BC1\uFF0C\u9001 100 \u7F8E\u5143\u989D\u5EA6\uFF0C\u4E0D\u7528\u4FE1\u7528\u5361", who: "\u5B66\u751F" },
  { name: "Figma \u6559\u80B2\u7248", url: "https://www.figma.com/education/", note: "\u5B66\u751F\u548C\u8001\u5E08\u514D\u8D39\u7528\u4E13\u4E1A\u7248", who: "\u5B66\u751F" },
  { name: "Notion \u6559\u80B2\u7248", url: "https://www.notion.com/product/notion-for-education", note: "\u5B66\u6821\u90AE\u7BB1\u6CE8\u518C\uFF0C\u4E2A\u4EBA Plus \u514D\u8D39", who: "\u5B66\u751F" },
  { name: "Autodesk \u6559\u80B2\u7248", url: "https://www.autodesk.com/education/home", note: "AutoCAD\u3001Maya\u3001Fusion \u7B49\u6559\u80B2\u8BB8\u53EF", who: "\u5B66\u751F" },
  { name: "Canva \u6559\u80B2\u7248", url: "https://www.canva.com/education/", note: "\u8001\u5E08\u548C\u5B66\u751F\u514D\u8D39\u7528\u9AD8\u7EA7\u529F\u80FD", who: "\u5B66\u751F" },
  { name: "Cloudflare \u514D\u8D39\u8BA1\u5212", url: "https://www.cloudflare.com/plans/free/", note: "CDN\u3001DNS\u3001Workers\u3001Pages\u3001R2 \u90FD\u6709\u957F\u671F\u514D\u8D39\u989D\u5EA6", who: "\u5F00\u53D1\u8005" },
  { name: "Oracle Cloud \u6C38\u4E45\u514D\u8D39", url: "https://www.oracle.com/cloud/free/", note: "\u6C38\u4E45\u514D\u8D39\u7684 ARM \u4E91\u4E3B\u673A\u548C\u6570\u636E\u5E93\uFF08\u6CE8\u518C\u8981\u7ED1\u5361\u9A8C\u8BC1\uFF09", who: "\u5F00\u53D1\u8005" },
  { name: "Google Cloud \u514D\u8D39\u5C42", url: "https://cloud.google.com/free", note: "\u65B0\u7528\u6237 300 \u7F8E\u5143\u989D\u5EA6 + \u957F\u671F\u514D\u8D39\u7684\u5C0F\u89C4\u683C\u8D44\u6E90", who: "\u5F00\u53D1\u8005" },
  { name: "AWS \u514D\u8D39\u5957\u9910", url: "https://aws.amazon.com/free/", note: "\u65B0\u7528\u6237\u989D\u5EA6 + \u4E00\u6279\u957F\u671F\u514D\u8D39\u7684\u670D\u52A1", who: "\u5F00\u53D1\u8005" },
  { name: "Vercel Hobby", url: "https://vercel.com/pricing", note: "\u4E2A\u4EBA\u9879\u76EE\u514D\u8D39\u6258\u7BA1\u524D\u7AEF\u548C Serverless \u51FD\u6570", who: "\u5F00\u53D1\u8005" },
  { name: "Netlify \u514D\u8D39\u7248", url: "https://www.netlify.com/pricing/", note: "\u9759\u6001\u7AD9\u70B9\u548C\u51FD\u6570\u514D\u8D39\u6258\u7BA1", who: "\u5F00\u53D1\u8005" },
  { name: "Supabase \u514D\u8D39\u7248", url: "https://supabase.com/pricing", note: "\u514D\u8D39\u7684 Postgres \u6570\u636E\u5E93\u3001\u8BA4\u8BC1\u548C\u5B58\u50A8", who: "\u5F00\u53D1\u8005" },
  { name: "EU.org \u514D\u8D39\u57DF\u540D", url: "https://nic.eu.org/", note: "\u8001\u724C\u514D\u8D39\u4E8C\u7EA7\u57DF\u540D\uFF0C\u4EBA\u5DE5\u5BA1\u6838\uFF0C\u53EF\u63A5 Cloudflare", who: "\u5F00\u53D1\u8005" },
  { name: "free-for-dev \u6E05\u5355", url: "https://free-for.dev/", note: "\u5F00\u53D1\u8005\u514D\u8D39\u670D\u52A1\u5927\u5168\uFF08\u82F1\u6587\uFF09\uFF0C\u6301\u7EED\u66F4\u65B0", who: "\u5F00\u53D1\u8005" }
];
function parseRows(text, keys) {
  const out = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith("#")) continue;
    const parts = l.split(/\s*[|｜]\s*/);
    const url = parts.find((x) => /^https?:\/\//.test(x));
    if (!url) continue;
    const rest = parts.filter((x) => x !== url);
    const o = { url };
    keys.forEach((k, i) => {
      if (rest[i]) o[k] = rest[i];
    });
    if (!o.name) {
      try {
        o.name = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        o.name = url;
      }
    }
    out.push(o);
    if (out.length >= 60) break;
  }
  return out;
}
var perksOf = (s) => s.perks_enabled === "false" ? [] : [...PERKS, ...parseRows(s.perks_extra, ["name", "note", "who"]).map((x) => ({ ...x, who: /学生|edu|student/i.test(x.who || "") ? "\u5B66\u751F" : "\u5F00\u53D1\u8005" }))];
var checkinOf = (s) => parseRows(s.checkin_sites, ["name", "note"]);
var VENDORS = [
  ["OpenAI", /openai|chatgpt|gpt-?\d|codex|sora/i],
  ["Anthropic", /anthropic|claude/i],
  ["Google", /google|gemini|antigravity|vertex|ai studio|jules/i],
  ["DeepSeek", /deepseek|深度求索/i],
  ["\u963F\u91CC", /qwen|通义|阿里云百炼|百炼|modelscope|魔搭/i],
  ["\u6708\u4E4B\u6697\u9762", /kimi|moonshot|月之暗面/i],
  ["\u667A\u8C31", /智谱|glm-?\d|chatglm|bigmodel/i],
  ["MiniMax", /minimax|海螺/i],
  ["\u5B57\u8282", /豆包|doubao|火山方舟|火山引擎|trae|coze|扣子/i],
  ["\u817E\u8BAF", /混元|hunyuan|腾讯云|codebuddy|元宝/i],
  ["\u767E\u5EA6", /文心|ernie|千帆/i],
  ["xAI", /xai|grok/i],
  ["Mistral", /mistral/i],
  ["Meta", /llama|meta ai/i],
  ["Microsoft", /microsoft|azure|copilot|bing/i],
  ["Amazon", /aws|amazon|bedrock|kiro/i],
  ["OpenRouter", /openrouter/i],
  ["Groq", /groq(?!k)/i],
  ["Cerebras", /cerebras/i],
  ["\u7845\u57FA\u6D41\u52A8", /siliconflow|硅基流动/i],
  ["NVIDIA", /nvidia|nim/i],
  ["Cursor", /cursor/i],
  ["Windsurf", /windsurf|codeium/i],
  ["GitHub", /github copilot|github models/i],
  ["Perplexity", /perplexity/i],
  ["Hugging Face", /hugging ?face/i],
  ["Cloudflare", /cloudflare workers ai|workers ai/i],
  ["Fireworks", /fireworks/i],
  ["Together", /together\.ai|together ai/i],
  ["\u516C\u76CA\u7AD9", /公益站|中转站|new ?api/i]
];
function guessVendor(text) {
  const t = String(text || "").replace(/^(【[^】]*】|\[[^\]]*\]|额度变化\s*·\s*)+/, "").trim().slice(0, 400);
  let best = null, at = Infinity;
  for (const [n, re] of VENDORS) {
    const m = re.exec(t);
    if (m && m.index < at) {
      best = n;
      at = m.index;
    }
  }
  const head = /^([A-Za-z][\w.+-]{1,24})(?=\s|：|:|，|的|上线|推出|限时|免费|送|宣布)/.exec(t);
  if (head && (best === null || at > head[1].length + 2) && !/^(AI|API|LLM|GPT|Free|The|New|Pro)$/i.test(head[1])) return head[1];
  return best;
}
var PERKS_TYPE = [
  ["\u4F18\u60E0\u7801", /优惠码|兑换码|折扣码|promo code|coupon|redeem/i],
  ["\u516C\u76CA\u7AD9", /公益站|中转站|new ?api|签到/i],
  ["\u514D\u8D39\u4F1A\u5458", /免费(领|送|获得)?.{0,6}(会员|pro|plus|max|studio|一个月|1 ?个月|月卡)|free (month|pro|plus)/i],
  ["\u8D60\u91D1", /送\s*[$¥￥]?\s*\d+\s*(刀|美元|美金|元|积分|credits?)|赠金|赠送.{0,6}(额度|积分|credits?)|\$\d+\s*(free )?credits?|免费.{0,4}\d+\s*(刀|美元|积分)/i],
  ["\u9650\u65F6\u514D\u8D39", /限时免费|限免|免费开放|限时.{0,6}免费|free for a limited time|limited[- ]time free/i],
  ["\u514D\u8D39\u989D\u5EA6", /免费额度|免费层|免费档|free tier|free plan|每日.{0,6}(次|额度)|免费调用|免费模型|:free/i]
];
function guessPerk(text) {
  const t = String(text || "").slice(0, 600);
  for (const [n, re] of PERKS_TYPE) if (re.test(t)) return n;
  return null;
}
var PERK_TYPES = PERKS_TYPE.map((x) => x[0]).concat("\u5176\u5B83");
var DEFAULT_RADAR_QUERIES = ["AI \u9650\u65F6\u514D\u8D39 \u9001\u989D\u5EA6", "\u5927\u6A21\u578B API \u514D\u8D39\u989D\u5EA6 \u6D3B\u52A8", "\u6CE8\u518C\u9001 \u7F8E\u5143 \u989D\u5EA6 API", "AI \u7F16\u7A0B\u52A9\u624B \u514D\u8D39 Pro", "AI \u516C\u76CA\u7AD9 \u6CE8\u518C\u9001\u989D\u5EA6", "\u514D\u8D39 Token \u6D3B\u52A8 \u5927\u6A21\u578B"];
var DEFAULT_RADAR_VENDORS = ["Claude", "Gemini", "ChatGPT", "DeepSeek", "\u901A\u4E49\u5343\u95EE Qwen", "Kimi", "\u667A\u8C31 GLM", "\u8C46\u5305 \u706B\u5C71\u65B9\u821F", "MiniMax", "Grok", "Cursor", "GitHub Copilot", "OpenRouter", "\u7845\u57FA\u6D41\u52A8", "Trae", "Perplexity"];
function radarQueries(s, round) {
  const base = String(s.aifree_queries || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const vendors = String(s.aifree_vendors || "").split(/\r?\n|,|，/).map((x) => x.trim()).filter(Boolean);
  const n = Math.min(8, Math.max(0, Number(s.aifree_vendors_per_run) || 4));
  const pick2 = [];
  for (let i = 0; i < Math.min(n, vendors.length); i++) pick2.push(vendors[(round * n + i) % vendors.length]);
  const qBase = Math.max(1, Math.min(8, Number(s.search_max_queries) || 6) - pick2.length);
  const b = [];
  for (let i = 0; i < Math.min(qBase, base.length); i++) b.push(base[(round * qBase + i) % base.length]);
  return [...b, ...pick2.map((v) => `${v} \u514D\u8D39 \u989D\u5EA6 \u798F\u5229`)];
}

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
  // 白嫖专源：内容本身就是免费资源，免关键词预筛、免 AI 审核直接入库（trusted），分类固定
  { name: "Epic \xB7 \u6BCF\u5468\u514D\u8D39\u6E38\u620F", type: "epic", category: "game", trusted: true, enabled: true },
  { name: "GamerPower \xB7 \u9650\u514D\u6E38\u620F", type: "gamerpower", category: "game", trusted: true, enabled: true },
  { name: "OpenRouter \xB7 \u514D\u8D39\u6A21\u578B", type: "openrouter_free", category: "ai", trusted: true, enabled: true },
  // include：标题需匹配的正则（这个源混有打折商品，只要 100% 免费的）
  { name: "SharewareOnSale \xB7 \u6B63\u7248\u8F6F\u4EF6\u9650\u514D", type: "rss", url: "https://sharewareonsale.com/feed", include: "100% discount|\\bfree\\b", category: "software", trusted: true, note: "\u6B63\u7248\u8F6F\u4EF6\u9650\u65F6 100% \u514D\u8D39\u9886\u53D6\uFF08\u82F1\u6587\u7AD9\uFF09", enabled: true },
  { name: "V2EX \xB7 \u521B\u610F", type: "v2ex", node: "create", enabled: false },
  // 中文白嫖专源。category: 'auto' 表示按关键词自动归类（归不进已勾选的分类就跳过）
  { name: "\u53CD\u6597\u9650\u514D \xB7 \u9650\u65F6\u514D\u8D39", type: "rss", url: "https://free.apprcn.com/feed/", category: "auto", fallback: "software", trusted: true, enabled: true },
  { name: "IT\u4E4B\u5BB6 \xB7 \u559C\u52A0\u4E00 / \u9650\u514D", type: "rss", url: "https://www.ithome.com/rss/", include: "\u559C\u52A0\u4E00|\u9650\u514D|\u9650\u65F6\u514D\u8D39|\u514D\u8D39\u9886|\u767D\u5AD6", category: "auto", fallback: "game", trusted: true, enabled: true },
  { name: "\u5982\u6709\u4E50\u4EAB \xB7 \u514D\u8D39\u8D44\u6E90", type: "rss", url: "https://51.ruyo.net/feed", enabled: true },
  { name: "\u5C0F\u4F17\u8F6F\u4EF6 \xB7 \u4E3B\u7AD9", type: "rss", url: "https://www.appinn.com/feed/", enabled: true },
  { name: "\u5F02\u6B21\u5143\u8F6F\u4EF6\u4E16\u754C", type: "rss", url: "https://feed.iplaysoft.com/", enabled: true },
  { name: "\u84DD\u70B9\u7F51", type: "rss", url: "https://www.landian.news/feed", include: "\u514D\u8D39|\u9650\u514D|\u767D\u5AD6|\u9886\u53D6|\u8D60\u9001", enabled: true },
  // cats：这个源只收哪些分类（其它分类的内容直接丢弃）；hint：关键词归不了类时默认归到哪个分类
  // 2026-11-21 实测可用的中文源
  { name: "\u96F6\u5EA6\u89E3\u8BF4 \xB7 \u514D\u8D39\u8F6F\u4EF6\u4E0E\u8D44\u6E90", type: "rss", url: "https://www.freedidi.com/feed", enabled: true },
  { name: "A\u59D0\u5206\u4EAB \xB7 \u514D\u8D39\u8D44\u6E90", type: "rss", url: "https://www.ahhhhfs.com/feed/", enabled: true },
  { name: "TG \xB7 A\u59D0\u5206\u4EAB @abskoop", type: "telegram", channel: "abskoop", enabled: true },
  { name: "TG \xB7 \u5728\u82B1\u79D1\u6280\u5708 @zaihuapd", type: "telegram", channel: "zaihuapd", include: "\u514D\u8D39|\u9650\u514D|\u767D\u5AD6|\u9886\u53D6|\u8D60\u9001|0\u5143|\u559C\u52A0\u4E00", enabled: true },
  { name: "\u798F\u5229\u5427", type: "rss", url: "https://fuliba.net/feed", include: "\u514D\u8D39|\u9650\u514D|\u767D\u5AD6|\u9886\u53D6|\u8D60\u9001|\u7F8A\u6BDB|\u798F\u5229", enabled: true },
  { name: "\u5C11\u6570\u6D3E \xB7 \u9650\u514D", type: "rss", url: "https://sspai.com/feed", include: "\u9650\u514D|\u514D\u8D39|\u767D\u5AD6", enabled: true },
  { name: "\u679C\u6838\u5265\u58F3", type: "rss", url: "https://www.ghxi.com/feed", cats: ["software", "dev", "ai", "pan"], hint: "software", enabled: true },
  { name: "\u5F02\u661F\u8F6F\u4EF6\u7A7A\u95F4", type: "rss", url: "https://www.yxssp.com/feed", cats: ["software", "dev", "ai"], hint: "software", enabled: true },
  { name: "\u514B\u9686\u7A9D", type: "rss", url: "https://www.uy5.net/feed/", cats: ["software", "dev", "ai"], hint: "software", enabled: true },
  { name: "\u7FFB\u5E94\u7528 \xB7 iOS \u9650\u514D", type: "rss", url: "https://www.iapps.me/feed", cats: ["software", "game"], hint: "software", enabled: true },
  { name: "FreeGroup \xB7 \u514D\u8D39\u8D44\u6E90", type: "rss", url: "https://free.com.tw/feed/", enabled: true },
  { name: "\u5176\u4E50 Keylol \xB7 \u6E38\u620F", type: "rss", url: "https://keylol.com/forum.php?mod=rss", include: "\u514D\u8D39|\u9650\u514D|\u559C\u52A0\u4E00|\u767D\u5AD6|\u9886\u53D6|\u8D60\u9001|giveaway", cats: ["game"], hint: "game", enabled: true },
  { name: "VPS\u7CBE\u9009\u7F51", type: "rss", url: "https://www.vpsjxw.com/feed/", cats: ["hosting", "domain", "cloud"], hint: "hosting", enabled: true },
  { name: "\u8001\u5DE6\u7B14\u8BB0", type: "rss", url: "https://www.laozuo.org/feed/", cats: ["hosting", "domain", "cloud"], hint: "hosting", enabled: true },
  { name: "\u4E3B\u673A\u767E\u79D1", type: "rss", url: "https://zhujiwiki.com/feed/", cats: ["hosting", "domain", "cloud"], hint: "hosting", enabled: true },
  { name: "VPS \u4FA6\u63A2", type: "rss", url: "https://www.vpser.net/feed", cats: ["hosting", "domain", "cloud"], hint: "hosting", enabled: true },
  { name: "VEIDC", type: "rss", url: "https://www.veidc.com/feed", cats: ["hosting", "domain", "cloud"], hint: "hosting", enabled: true },
  { name: "VPSGO", type: "rss", url: "https://www.vpsgo.com/feed", cats: ["hosting", "domain", "cloud"], hint: "hosting", enabled: true },
  { name: "xiaoz \u535A\u5BA2", type: "rss", url: "https://blog.xiaoz.org/feed", cats: ["hosting", "domain", "cloud", "dev", "software"], enabled: true },
  { name: "TG \xB7 \u7F51\u76D8\u8D44\u6E90\uFF08\u8FC5\u96F7\u4E91\u76D8\uFF09@yunpanxunlei", type: "telegram", channel: "yunpanxunlei", category: "pan", trusted: true, enabled: false },
  // ---------- AI 专区（2026-11-22 实测可抓） ----------
  // Ailyre AI 速递（ailyre.com/news）：「福利速递」轨道是厂商福利（限时免费开放、优惠码、送额度），其余是模型上新和服务变动
  { name: "Ailyre \xB7 AI \u798F\u5229\u901F\u9012", type: "rss", url: "https://www.ailyre.com/news/rss.xml", tags: ["\u798F\u5229\u901F\u9012"], cats: ["ai", "aideal"], hint: "aideal", every: 3, enabled: true },
  { name: "Ailyre \xB7 AI \u901F\u9012\uFF08\u6A21\u578B\u4E0E\u670D\u52A1\u53D8\u52A8\uFF09", type: "rss", url: "https://www.ailyre.com/news/rss.xml", skip_tags: ["\u798F\u5229\u901F\u9012"], category: "ainews", trusted: true, limit: 10, every: 6, enabled: true },
  { name: "\u8D5B\u535A\u9E21\u86CB \xB7 AI \u514D\u8D39\u989D\u5EA6", type: "rss", url: "https://jidan.si/rss.xml", cats: ["ai", "aideal", "aitool"], hint: "ai", enabled: true },
  { name: "AI \u798F\u5229\u96F7\u8FBE", type: "rss", url: "https://aifuli.dev/rss.xml", cats: ["ai", "aideal", "aitool"], hint: "aideal", enabled: true },
  { name: "free-llm-intel \xB7 \u514D\u8D39\u989D\u5EA6\u53D8\u5316", type: "rss", url: "https://free-llm-intel.aishort.top/feeds/llm-intel-changes.xml", category: "ai", trusted: true, limit: 15, enabled: true },
  { name: "TG \xB7 LINUX DO \u798F\u5229 @linuxdo_tg", type: "telegram", channel: "linuxdo_tg", include: "\u798F\u5229\u7F8A\u6BDB|\u516C\u76CA\u7AD9|\u516C\u76CA\u63A8\u5E7F|\u767D\u5AD6|\u514D\u8D39|\u989D\u5EA6|\u8D60\u9001|\u9001\\s*\\$?\\d", cats: ["ai", "aideal", "aitool", "cloud", "dev"], hint: "aideal", enabled: true },
  { name: "TG \xB7 \u82F9\u679C\u79D1\u6280 @pgkj666", type: "telegram", channel: "pgkj666", include: "API|\u989D\u5EA6|Token|\u514D\u8D39|\u516C\u76CA|\u4E2D\u8F6C", cats: ["ai", "aideal", "aitool"], hint: "aideal", enabled: true },
  // GitHub 同类清单：仓库一有新提交，就把新增的条目同步过来（读 commits.atom + 提交的 .patch，不走 GitHub API，不需要 Token）
  { name: "GitHub \xB7 \u514D\u8D39 AI API \u4E2D\u8F6C\u7AD9\u5BFC\u822A", type: "repo", repo: "kirito8/free-newapi", mode: "diff", include: "\u516C\u76CA|\u514D\u8D39|\u7B7E\u5230|\u6CE8\u518C\u9001|\u8D60\u9001|\u9001\\s*[$\xA5]?\\d|\u767D\u5AD6|\u989D\u5EA6", category: "aideal", trusted: true, every: 12, enabled: true },
  { name: "GitHub \xB7 AI API \u516C\u76CA\u7AD9\u5BFC\u822A", type: "repo", repo: "bubblevv/ai-api-gongyi-nav", mode: "diff", path: "README\\.md$", include: "\u516C\u76CA|\u514D\u8D39|\u7B7E\u5230|\u6CE8\u518C\u9001|\u8D60\u9001|\u9001\\s*[$\xA5]?\\d|\u767D\u5AD6|\u989D\u5EA6", category: "aideal", trusted: true, every: 12, enabled: true },
  { name: "GitHub \xB7 \u514D\u8D39 AI Token \u6E05\u5355\uFF08\u4E2D\u56FD\u533A\uFF09", type: "repo", repo: "KJAI123/awesome-free-ai-tokens-cn", mode: "diff", category: "ai", trusted: true, every: 12, enabled: true },
  { name: "GitHub \xB7 \u514D\u8D39\u5927\u6A21\u578B API \u5BFC\u822A", type: "repo", repo: "peter123023/awesome-free-llm-api", mode: "diff", path: "README\\.md$", category: "ai", trusted: true, every: 12, enabled: true },
  { name: "GitHub \xB7 FreeToken \u514D\u8D39\u989D\u5EA6\u5927\u5168", type: "repo", repo: "AIPMAndy/FreeToken", mode: "diff", path: "README", category: "ai", trusted: true, every: 12, enabled: true },
  { name: "GitHub \xB7 \u514D\u8D39 LLM API \u5E73\u53F0\u6C47\u603B", type: "repo", repo: "CYBIRD-D/FREE-LLM-API-Provider", mode: "diff", path: "README\\.zh-CN\\.md$", category: "ai", trusted: true, every: 12, enabled: true },
  { name: "GitHub \xB7 \u4E2D\u56FD\u72EC\u7ACB\u5F00\u53D1\u8005\u9879\u76EE", type: "repo", repo: "1c7/chinese-independent-developer", mode: "diff", path: "^README\\.md$", cats: ["aitool", "software", "dev"], hint: "software", category: "auto", fallback: "software", trusted: true, every: 12, enabled: false },
  { name: "GitHub \xB7 free-for-dev\uFF08\u82F1\u6587\uFF09", type: "repo", repo: "ripienaar/free-for-dev", mode: "diff", cats: ["dev", "cloud", "hosting", "ai"], hint: "dev", every: 12, enabled: false },
  // ---------- 新闻资讯：资讯类专源直接收录，每次每个源最多取 limit 条 ----------
  { name: "free-llm-intel \xB7 AI \u5382\u5546\u52A8\u6001", type: "rss", url: "https://free-llm-intel.aishort.top/feeds/llm-news-all.xml", category: "ainews", trusted: true, limit: 12, every: 6, enabled: true },
  { name: "\u91CF\u5B50\u4F4D", type: "rss", url: "https://www.qbitai.com/feed", category: "ainews", trusted: true, limit: 10, every: 6, enabled: true },
  { name: "Solidot", type: "rss", url: "https://www.solidot.org/index.rss", category: "news", trusted: true, limit: 10, every: 6, enabled: true },
  { name: "\u7231\u8303\u513F", type: "rss", url: "https://www.ifanr.com/feed", category: "news", trusted: true, limit: 10, every: 6, enabled: true },
  { name: "cnBeta", type: "rss", url: "https://www.cnbeta.com.tw/backend.php", category: "news", trusted: true, limit: 10, every: 6, enabled: true },
  { name: "\u6781\u5BA2\u516C\u56ED", type: "rss", url: "https://www.geekpark.net/rss", category: "news", trusted: true, limit: 8, every: 6, enabled: true },
  { name: "\u962E\u4E00\u5CF0 \xB7 \u79D1\u6280\u7231\u597D\u8005\u5468\u520A", type: "rss", url: "https://www.ruanyifeng.com/blog/atom.xml", category: "news", trusted: true, limit: 3, every: 6, enabled: true },
  // ---------- 免费梯子：GitHub 上自动更新的公共节点订阅，每个仓库只占一条，有新提交就刷新时间 ----------
  { name: "Pawdroid / Free-servers", type: "repo", repo: "Pawdroid/Free-servers", mode: "sub", category: "proxy", trusted: true, subs: [["\u901A\u7528\u8BA2\u9605", "https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub"]], every: 12, enabled: true },
  { name: "ermaozi / get_subscribe", type: "repo", repo: "ermaozi/get_subscribe", mode: "sub", category: "proxy", trusted: true, subs: [["V2Ray", "https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/v2ray.txt"], ["Clash", "https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/clash.yml"]], every: 12, enabled: true },
  { name: "chengaopan / AutoMergePublicNodes", type: "repo", repo: "chengaopan/AutoMergePublicNodes", mode: "sub", category: "proxy", trusted: true, subs: [["V2Ray", "https://raw.githubusercontent.com/chengaopan/AutoMergePublicNodes/master/list.txt"], ["Clash", "https://raw.githubusercontent.com/chengaopan/AutoMergePublicNodes/master/list.yml"]], every: 12, enabled: true },
  { name: "peasoft / NoMoreWalls", type: "repo", repo: "peasoft/NoMoreWalls", mode: "sub", category: "proxy", trusted: true, subs: [["V2Ray", "https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list.txt"], ["Clash", "https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list.yml"]], every: 12, enabled: true },
  { name: "mahdibland / V2RayAggregator", type: "repo", repo: "mahdibland/V2RayAggregator", mode: "sub", category: "proxy", trusted: true, subs: [["V2Ray", "https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt"], ["Clash", "https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/Eternity.yml"]], every: 12, enabled: true },
  { name: "snakem982 / proxypool", type: "repo", repo: "snakem982/proxypool", mode: "sub", category: "proxy", trusted: true, subs: [["V2Ray", "https://raw.githubusercontent.com/snakem982/proxypool/main/source/v2ray-2.txt"], ["Clash Meta", "https://raw.githubusercontent.com/snakem982/proxypool/main/source/clash-meta-2.yaml"]], every: 12, enabled: true },
  { name: "Barabama / FreeNodes", type: "repo", repo: "Barabama/FreeNodes", mode: "sub", category: "proxy", trusted: true, subs: [["V2Ray", "https://raw.githubusercontent.com/Barabama/FreeNodes/main/nodes/clashmeta.txt"], ["Clash Meta", "https://raw.githubusercontent.com/Barabama/FreeNodes/main/nodes/clashmeta.yaml"]], every: 12, enabled: true },
  { name: "free18 / v2ray", type: "repo", repo: "free18/v2ray", mode: "sub", category: "proxy", trusted: true, subs: [["V2Ray", "https://raw.githubusercontent.com/free18/v2ray/main/v.txt"], ["Clash", "https://raw.githubusercontent.com/free18/v2ray/main/c.yaml"]], every: 12, enabled: true },
  // 英文社区：默认过滤纯英文内容，这些源默认关闭；关掉「过滤纯英文」后可按需打开
  { name: "LowEndTalk \xB7 Offers", type: "rss", url: "https://lowendtalk.com/categories/offers/feed.rss", enabled: false },
  { name: "LowEndSpirit", type: "rss", url: "https://lowendspirit.com/discussions/feed.rss", enabled: false },
  { name: "Hacker News \xB7 free domain", type: "hn", query: '"free domain"', enabled: false },
  { name: "Hacker News \xB7 free subdomain", type: "hn", query: '"free subdomain"', enabled: false },
  { name: "Hacker News \xB7 free hosting", type: "hn", query: '"free hosting"', enabled: false },
  // GitHub 仓库搜索噪音大，建议配合 AI 判定再开启
  { name: "GitHub \xB7 free domain", type: "github", query: "free domain", ai_only: true, enabled: false },
  { name: "GitHub \xB7 free hosting", type: "github", query: "free hosting", ai_only: true, enabled: false },
  // ai_only：讨论帖多，只有配置了 AI 判定时才抓
  { name: "Hacker News \xB7 free tier", type: "hn", query: '"free tier"', ai_only: true, enabled: false },
  { name: "Hacker News \xB7 free credits", type: "hn", query: '"free credits"', ai_only: true, enabled: false },
  // Reddit 常拦截机房 IP，默认关闭
  { name: "Reddit \xB7 free domain", type: "reddit", query: "free domain", enabled: false },
  { name: "Reddit \xB7 free web hosting", type: "reddit", query: "free web hosting", enabled: false }
];
var DEFAULT_SETTINGS = {
  // AI 判定（OpenAI 兼容接口）
  ai_enabled: "true",
  // 可选：填好接口地址、Key、模型就自动使用；不填则用关键词判定
  ai_base_url: "https://api.openai.com/v1",
  ai_api_key: "",
  ai_model: "",
  ai_batch_size: "12",
  // 每次请求判定几条
  ai_max_items: "60",
  // 每次运行最多送 AI 判定几条（免费版 Worker 每次最多 50 个外部请求，别设太大）
  ai_min_score: "60",
  ai_review: "smart",
  // smart：把握大的自动通过 / 拒绝，只把拿不准的交给 AI；all：全部交给 AI
  fresh_days: "15",
  // 发布超过这么多天的条目，前台和邮件里单独归到「较早发布」
  ai_cache: "true",
  // 同一个目标地址判过一次就复用结论，不重复花 AI 额度
  // 联网搜索后端（见 search.js 的 BACKENDS）。全部默认开启：AnySearch、Keenable 免 Key 直接可用；其余填了 Key 就自动参与，没填就跳过
  anysearch_enabled: "true",
  anysearch_api_key: "",
  // 可选；填了就固定走 Key
  keenable_enabled: "true",
  keenable_api_key: "",
  // 可选；留空走免 Key 公共接口（按 IP 限流）
  keenable_mode: "pro",
  // pro / realtime
  tavily_enabled: "true",
  tavily_api_key: "",
  tavily_depth: "basic",
  // basic / advanced / fast
  exa_enabled: "true",
  exa_api_key: "",
  brave_enabled: "true",
  brave_api_key: "",
  qianfan_enabled: "true",
  qianfan_api_key: "",
  volc_enabled: "true",
  volc_api_key: "",
  // 每个搜索后端负责哪些分类（逗号分隔的分类 key，留空 = 全部已勾选分类）：只用这些分类生成搜索词，结果也只收这些分类
  anysearch_cats: "",
  keenable_cats: "",
  tavily_cats: "",
  exa_cats: "",
  brave_cats: "",
  qianfan_cats: "",
  volc_cats: "",
  // 后台「更新源」从这些地址拉取数据源（每行一个）：freebie-radar 的 SEEDS（.ts）或本项目格式的 JSON 数组
  source_sync_urls: "https://raw.githubusercontent.com/ZiChuanLan/freebie-radar/main/src/server/collectors/index.ts",
  search_max_results: "10",
  // 每个查询返回条数
  search_queries: "",
  // 留空：按勾选的分类自动生成中文搜索词；填写则只用你写的
  search_max_queries: "6",
  // 每次最多查几个词（省额度，也避免超出 Worker 外部请求上限）
  search_lang: "zh_only",
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
  // 收件人，多个用逗号分隔（最多 10 个）
  mail_separate: "true",
  // 每个收件人单独发一封，互相看不到地址
  mail_subject: "\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE \xB7 \u4ECA\u65E5\u767D\u5AD6",
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
  // Webhook 类推送（地址 / Key 存 KV），填了就推；{id}_enabled 可单独关掉
  ...Object.fromEntries(PUSH_CHANNELS.flatMap((c) => [[c.key, ""], [`${c.id}_enabled`, "true"], ...c.secret ? [[c.secret, ""]] : []])),
  // 抓取与过滤
  noise_filter: "true",
  filter_english: "true",
  // 过滤纯英文内容（标题和正文都没有中文就丢弃）      // 跳过求助 / 吐槽类标题，不送 AI
  allowed_obtain: "free,conditional",
  // 允许的获取方式：free 直接白嫖 / conditional 有条件 / trial / lottery / promo / paid
  block_rules: ["# \u6BCF\u884C\u4E00\u6761\uFF0C\u666E\u901A\u6587\u672C\u4E3A\u5173\u952E\u8BCD\uFF0C/\u6B63\u5219/i \u4E3A\u6B63\u5219\uFF1B\u547D\u4E2D\u5373\u4E22\u5F03\uFF0C\u4E0D\u9001 AI", "\u5DF2\u5931\u6548", "/\u5DF2(\u5173\u95ED|\u505C\u6B62)\u6CE8\u518C/"].join("\n"),
  max_age_days: "180",
  // 超过半年的消息过滤掉
  retention_days: "15",
  run_hour: "9",
  // 每天第一次抓取的时间（北京时间，0-23）
  crawl_every_hours: "6",
  // 每隔几小时抓一次（从 run_hour 起算；24 = 每天一次）
  mail_hours: "9,21",
  // 每天几点推送（北京时间，逗号分隔；若刚好在抓取，抓完再推）
  steps_per_tick: "1",
  // 每次定时调用执行几步；免费版保持 1（10ms CPU 限制），付费版可调大   // 抓到的数据按日期存储，保留 15 天后自动清理
  keep_undated: "false",
  // 无发布日期的条目是否保留
  // 访问触发与缓存
  trigger_min_seconds: "30",
  // 触发地址 / 访问触发的最小间隔（秒），间隔内的请求直接返回不执行
  visit_trigger: "false",
  // 有人打开资源页时顺带推进一步抓取（定时任务的备用方案）
  public_cache_seconds: "60",
  // 资源页数据缓存秒数，缓存期内不查数据库
  // AI 福利雷达：用已开启的搜索后端按福利词 + 厂商轮流搜，结果只收「AI 免费额度 / AI 限时福利」，再经判定整理
  aifree_radar: "true",
  aifree_queries: DEFAULT_RADAR_QUERIES.join("\n"),
  aifree_vendors: DEFAULT_RADAR_VENDORS.join("\n"),
  aifree_vendors_per_run: "3",
  // 每轮轮到几个厂商
  aifree_days: "30",
  // 只要最近多少天的
  // v1.8 板块与功能
  search_strict: "true",
  // 搜索结果标题里必须有免费类字样（搜索来的条目质量参差，从严）
  watch_enabled: "true",
  // 关键词提醒：命中就单独推送，不等日报
  watch_keywords: "",
  // 每行一个关键词，如 Claude / 域名 / VPS
  link_check: "true",
  // 失效检测：每次抓取后抽查一批链接，打不开或写着已结束的标灰下沉
  link_check_per_run: "5",
  weekly_enabled: "false",
  // 每周精选：每周一（可改）随推送附带本周最值的 10 条
  weekly_weekday: "1",
  // 0 = 周日，1 = 周一 …
  vote_hide: "3",
  // 「不值」比「值」多这么多票就自动隐藏（0 = 不隐藏）
  checkin_sites: "",
  // 签到清单，每行：名称 | 地址 | 备注
  perks_extra: "",
  // 学生 / 开发者专区追加，每行：名称 | 地址 | 说明 | 学生 或 开发者
  login_max_fails: "10",
  // 同一 IP 15 分钟内登录失败这么多次就暂时锁定
  api_rate_per_min: "120",
  // 公开接口每个 IP 每分钟最多请求数（0 = 不限）
  // 分类：勾选要收集的；推送分类留空 = 与收集相同
  enabled_categories: "domain,hosting,cloud,ai,aideal,aitool,software,dev,game,edu,ainews,news,proxy",
  mail_categories: "",
  simple_signup_only: "true",
  // 只要注册简单的（邮箱 / GitHub / Google 登录）
  topic_keywords: "",
  // 额外主题词（每个分类已内置关键词，这里只需补充）
  free_keywords: ["\u514D\u8D39", "\u767D\u5AD6", "0\u5143", "\u96F6\u5143", "\u6C38\u4E45\u514D\u8D39", "\u9650\u514D", "\u9650\u65F6\u514D\u8D39", "\u559C\u52A0\u4E00", "\u9001", "\u9886\u53D6", "free", "gratis", "$0", "giveaway", "100% off"].join("\n"),
  hard_signup_keywords: ["\u4FE1\u7528\u5361", "\u94F6\u884C\u5361", "\u7ED1\u5361", "\u5B9E\u540D", "\u8EAB\u4EFD\u8BC1", "kyc", "\u624B\u673A\u9A8C\u8BC1", "\u77ED\u4FE1\u9A8C\u8BC1", "\u9080\u8BF7\u7801", "credit card", "debit card", "phone verification", "sms verification", "id verification", "passport", "invite code"].join("\n"),
  sources: JSON.stringify(DEFAULT_SOURCES, null, 2)
};
var SEARCH_KEYS = ["anysearch_api_key", "keenable_api_key", "tavily_api_key", "exa_api_key", "brave_api_key", "qianfan_api_key", "volc_api_key"];
var SECRET_KEYS = ["ai_api_key", "mail_api_key", "smtp_pass", "telegram_bot_token", ...SEARCH_KEYS, ...PUSH_KEYS];
var KV_KEYS = ["ai_base_url", "ai_api_key", "mail_api_key", "smtp_user", "smtp_pass", "telegram_bot_token", "telegram_chat_id", ...SEARCH_KEYS, ...PUSH_KEYS];
var kvName = (k) => `cfg:${k}`;
var schemaReady = false;
var SCHEMA_VER = "1.8.1";
async function ensureSchema(env) {
  if (schemaReady) return;
  const cur = await env.DB.prepare("SELECT value FROM secrets WHERE key = 'meta:schema'").first().catch(() => null);
  if (cur?.value === SCHEMA_VER) {
    schemaReady = true;
    return;
  }
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, source TEXT, raw_text TEXT, published_at INTEGER, fetched_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', category TEXT, name TEXT, summary TEXT, signup TEXT, score INTEGER, judged_by TEXT, judged_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0)`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_items_status ON items(status, published_at)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS runs (id INTEGER PRIMARY KEY AUTOINCREMENT, trigger TEXT, started_at INTEGER, finished_at INTEGER, stats TEXT, log TEXT)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS secrets (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    // 一次抓取拆成的步骤（每个数据源 / 判定批次 / 推送各一步），定时任务每分钟执行一步
    env.DB.prepare("CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, seq INTEGER NOT NULL, kind TEXT NOT NULL, payload TEXT, status TEXT NOT NULL DEFAULT 'pending', claimed_at INTEGER, tries INTEGER NOT NULL DEFAULT 0)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_jobs_run ON jobs(run_id, status, seq)"),
    // 去重记忆：条目 15 天后会清理，但“见过”的记录保留更久，避免旧帖被重新抓取、重复推送
    env.DB.prepare("CREATE TABLE IF NOT EXISTS seen (id TEXT PRIMARY KEY, fp TEXT, seen_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_seen_fp ON seen(fp)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_seen_at ON seen(seen_at)"),
    // v1.8：投票、来源健康、AI 结论缓存、登录失败计数
    env.DB.prepare("CREATE TABLE IF NOT EXISTS votes (id TEXT NOT NULL, voter TEXT NOT NULL, v INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (id, voter))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS src_health (name TEXT NOT NULL, day TEXT NOT NULL, fetched INTEGER NOT NULL DEFAULT 0, added INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0, last_at INTEGER, last_err TEXT, PRIMARY KEY (name, day))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS verdicts (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS rate (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset INTEGER NOT NULL)"),
    // v1.8.1：资源页快照（分块预先生成，访问时直接读）
    env.DB.prepare("CREATE TABLE IF NOT EXISTS snap (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL)")
  ]);
  const cols = new Set(((await env.DB.prepare("PRAGMA table_info(items)").all()).results || []).map((r) => r.name));
  const add = [["obtain", "TEXT"], ["fp", "TEXT"], ["day", "TEXT"], ["cats", "TEXT"], ["hint", "TEXT"], ["target", "TEXT"], ["sources", "TEXT"], ["extra", "TEXT"], ["expires_at", "INTEGER"], ["up", "INTEGER NOT NULL DEFAULT 0"], ["down", "INTEGER NOT NULL DEFAULT 0"], ["dead", "INTEGER NOT NULL DEFAULT 0"], ["checked_at", "INTEGER"]].filter(([c]) => !cols.has(c));
  for (const [c, t] of add) {
    try {
      await env.DB.prepare(`ALTER TABLE items ADD COLUMN ${c} ${t}`).run();
    } catch {
    }
  }
  const jcols = new Set(((await env.DB.prepare("PRAGMA table_info(jobs)").all()).results || []).map((r) => r.name));
  if (!jcols.has("claimed_at")) {
    try {
      await env.DB.prepare("ALTER TABLE jobs ADD COLUMN claimed_at INTEGER").run();
    } catch {
    }
  }
  if (!jcols.has("tries")) {
    try {
      await env.DB.prepare("ALTER TABLE jobs ADD COLUMN tries INTEGER NOT NULL DEFAULT 0").run();
    } catch {
    }
  }
  if (add.length) {
    await env.DB.batch([
      "CREATE INDEX IF NOT EXISTS idx_items_target ON items(target)",
      "CREATE INDEX IF NOT EXISTS idx_items_fp ON items(fp)",
      "CREATE INDEX IF NOT EXISTS idx_items_day ON items(day, status)",
      "CREATE INDEX IF NOT EXISTS idx_items_fetched ON items(fetched_at)",
      "CREATE INDEX IF NOT EXISTS idx_items_expires ON items(expires_at)",
      "CREATE INDEX IF NOT EXISTS idx_health_name ON src_health(name, last_at)"
    ].map((q) => env.DB.prepare(q))).catch(() => {
    });
  }
  await env.DB.prepare("INSERT INTO secrets (key, value) VALUES ('meta:schema', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(SCHEMA_VER).run();
  schemaReady = true;
}
async function getSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of results || []) if (r.key in DEFAULT_SETTINGS) s[r.key] = r.value;
  const sec = await env.DB.prepare("SELECT key, value FROM secrets").all();
  for (const r of sec.results || []) if (KV_KEYS.includes(r.key)) s[r.key] = r.value;
  if (env.SECRETS) Object.assign(s, await kvAll(env));
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
var KV_ALL = "cfg:__all";
var kvMemo = null;
async function kvAll(env) {
  if (kvMemo && kvMemo.exp > Date.now()) return kvMemo.v;
  let v = null;
  try {
    v = JSON.parse(await env.SECRETS.get(KV_ALL) || "null");
  } catch {
  }
  if (!v) {
    const vals = await Promise.all(KV_KEYS.map((k) => env.SECRETS.get(kvName(k))));
    v = {};
    KV_KEYS.forEach((k, i) => {
      if (vals[i] !== null) v[k] = vals[i];
    });
    await env.SECRETS.put(KV_ALL, JSON.stringify(v)).catch(() => {
    });
  }
  kvMemo = { v, exp: Date.now() + 6e4 };
  return v;
}
async function saveSettings(env, patch) {
  const stmts = [];
  const kvWrites = [];
  const kvPatch = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (!(k in DEFAULT_SETTINGS)) continue;
    let val = typeof v === "boolean" ? String(v) : String(v ?? "");
    if (SECRET_KEYS.includes(k) && val.includes("****")) continue;
    if (k === "sources") JSON.parse(val);
    if (KV_KEYS.includes(k)) {
      stmts.push(env.DB.prepare("DELETE FROM settings WHERE key = ?").bind(k));
      if (env.SECRETS) {
        kvPatch[k] = val;
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
  if (Object.keys(kvPatch).length) {
    kvMemo = null;
    const all = { ...await kvAll(env), ...kvPatch };
    kvWrites.push(env.SECRETS.put(KV_ALL, JSON.stringify(all)));
    kvMemo = { v: all, exp: Date.now() + 6e4 };
  }
  await Promise.all(kvWrites);
  if (stmts.length) await env.DB.batch(stmts);
}
async function getBasicSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of results || []) if (r.key in DEFAULT_SETTINGS && !KV_KEYS.includes(r.key)) s[r.key] = r.value;
  return s;
}
async function getMeta(env, k) {
  const r = await env.DB.prepare("SELECT value FROM secrets WHERE key = ?").bind("meta:" + k).first();
  return r?.value ?? null;
}
function setMeta(env, k, v) {
  return env.DB.prepare("INSERT INTO secrets (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind("meta:" + k, String(v)).run();
}
async function getCronKey(env, regenerate = false) {
  let k = regenerate ? null : await getMeta(env, "cron_key");
  if (!k) {
    k = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");
    await setMeta(env, "cron_key", k);
  }
  return k;
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
async function getSitePassHash(env) {
  const r = await env.DB.prepare("SELECT value FROM secrets WHERE key = 'site_pass_hash'").first();
  return r?.value || "";
}
async function setSitePass(env, password) {
  if (!password) return env.DB.prepare("DELETE FROM secrets WHERE key = 'site_pass_hash'").run();
  const h = await sha256("frr-site:" + password);
  return env.DB.prepare("INSERT INTO secrets (key, value) VALUES ('site_pass_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(h).run();
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
var catLine = (s) => enabledCats(s).map((k) => `${k}=${CAT_MAP[k].label}`).join("\uFF0C");
var judgePrompt = (s) => `\u4F60\u662F"\u514D\u8D39\u8D44\u6E90 / \u767D\u5AD6\u798F\u5229"\u5BA1\u6838\u5458\u3002\u9010\u6761\u5224\u65AD\u8F93\u5165\u7684\u5E16\u5B50\u6216\u9875\u9762\uFF0C\u53EA\u8F93\u51FA\u4E25\u683C JSON\u3002
\u5173\u6CE8\u7684\u5206\u7C7B\uFF08category \u53EA\u80FD\u53D6\u8FD9\u4E9B key\uFF0C\u4E0D\u5C5E\u4E8E\u4EFB\u4F55\u4E00\u7C7B\u586B other\uFF09\uFF1A${catLine(s)}\u3002
\u5206\u7C7B\u8BF4\u660E\uFF1Aai=\u957F\u671F\u6709\u6548\u7684\u514D\u8D39\u989D\u5EA6 / \u514D\u8D39\u6A21\u578B / \u514D\u8D39 API\uFF1Baideal=\u6709\u65F6\u6548\u7684 AI \u798F\u5229\uFF08\u9650\u65F6\u514D\u8D39\u5F00\u653E\u3001\u6CE8\u518C\u9001\u989D\u5EA6\u3001\u4F18\u60E0\u7801 / \u514D\u8D39\u6708\u3001\u516C\u76CA\u7AD9\u7B7E\u5230\uFF09\u3002
\u5224\u5B9A\u89C4\u5219\uFF1A
1. relevant\uFF1A\u5185\u5BB9\u786E\u5B9E\u5728\u63D0\u4F9B\u6216\u4ECB\u7ECD\u3010\u53EF\u514D\u8D39\u83B7\u5F97\u3011\u4E14\u5C5E\u4E8E\u4E0A\u8FF0\u5206\u7C7B\u7684\u8D44\u6E90\uFF08\u514D\u8D39\u989D\u5EA6\u3001\u9650\u514D\u3001\u8D60\u9001\u3001\u514D\u8D39\u5957\u9910\u7B49\uFF09\u3002\u4EE5\u4E0B\u60C5\u51B5\u4E3A false\uFF1A\u7EAF\u8BA8\u8BBA\u6216\u6C42\u52A9\u3001\u4ED8\u8D39\u4FC3\u9500\u6216\u6253\u6298\uFF08\u975E\u514D\u8D39\uFF09\u3001\u5DF2\u5931\u6548 / \u5DF2\u5173\u95ED / \u5DF2\u552E\u7F44 / \u5DF2\u9886\u5B8C\u3001\u5E7F\u544A\u6216\u660E\u663E\u4E0D\u53EF\u4FE1\u3001\u65B0\u95FB\u8D44\u8BAF\u3002
2. simple_signup\uFF1A\u53EA\u9700\u90AE\u7BB1\uFF0C\u6216 GitHub / Google \u7B49\u7B2C\u4E09\u65B9\u8D26\u53F7\u5373\u53EF\u6CE8\u518C\u4F7F\u7528 \u2192 true\u3002\u9700\u8981\u4FE1\u7528\u5361 / PayPal \u7ED1\u5361\u3001\u624B\u673A\u53F7\u77ED\u4FE1\u9A8C\u8BC1\u3001\u5B9E\u540D / KYC / \u8EAB\u4EFD\u8BC1\u3001\u9080\u8BF7\u7801\u3001\u4EBA\u5DE5\u5BA1\u6838\u7533\u8BF7\u3001\u5148\u4ED8\u8D39 \u2192 false\u3002\u4FE1\u606F\u4E0D\u8DB3\u65F6\u6309\u5E38\u8BC6\u8C28\u614E\u5224\u65AD\uFF0C\u5E76\u5728 signup \u5B57\u6BB5\u5199\u660E\u4F9D\u636E\u3002
3. obtain\uFF1A\u83B7\u53D6\u65B9\u5F0F\uFF0C\u53EA\u80FD\u662F free\uFF08\u76F4\u63A5\u767D\u5AD6\uFF0C\u6CE8\u518C\u5373\u7528\uFF09\u3001conditional\uFF08\u9700\u8981\u5B8C\u6210\u7B80\u5355\u4EFB\u52A1\uFF0C\u5982\u56DE\u5E16\u3001\u9080\u8BF7\u3001\u7B7E\u5230\uFF09\u3001lottery\uFF08\u62BD\u5956 / \u540D\u989D\u968F\u673A\uFF09\u3001trial\uFF08\u9650\u65F6\u8BD5\u7528\uFF0C\u5230\u671F\u6536\u8D39\uFF09\u3001promo\uFF08\u5546\u5BB6\u63A8\u5E7F\u5F15\u6D41\uFF09\u3001paid\uFF08\u9700\u8981\u4ED8\u8D39\uFF09\u3002
4. score\uFF1A0-100 \u7684\u6574\u6570\uFF0C\u7EFC\u5408\u76F8\u5173\u6027\u3001\u6CE8\u518C\u7B80\u6613\u5EA6\u3001\u8D44\u6E90\u4EF7\u503C\u3001\u53EF\u4FE1\u5EA6\u3001\u662F\u5426\u957F\u671F\u53EF\u7528\u3002
5. summary\uFF1A\u798F\u5229\u7C7B\u5199\u300C\u9001\u4EC0\u4E48 + \u6709\u4EC0\u4E48\u9650\u5236\u300D\uFF0C\u8D44\u8BAF\u7C7B\u5199\u4E00\u53E5\u8BDD\u8981\u70B9\uFF0C\u90FD\u4E0D\u8D85\u8FC7 40 \u5B57\uFF1Bhow\uFF1A\u600E\u4E48\u9886\uFF08\u5982\u201CGitHub \u767B\u5F55\u540E\u5728\u63A7\u5236\u53F0\u9886\u53D6\u201D\uFF09\uFF0C20 \u5B57\u5185\uFF0C\u6CA1\u6709\u5C31\u586B null\uFF1Bdeadline\uFF1A\u539F\u6587\u5199\u660E\u7684\u622A\u6B62\u65E5\u671F YYYY-MM-DD\uFF0C\u6CA1\u5199\u5C31\u586B null\uFF0C\u4E0D\u8981\u731C\u3002
6. name\uFF1A\u670D\u52A1\u6216\u8D44\u6E90\u672C\u8EAB\u7684\u540D\u5B57\uFF08\u5982\u201CCloudflare R2\u201D\uFF09\uFF0C\u4E0D\u8981\u5E26\u7AD9\u70B9\u540D\u3001\u3010\u8F6C\u3011\u4E4B\u7C7B\u7684\u524D\u540E\u7F00\u3002
7. \u53EA\u5BF9 ai / aideal \u4E24\u7C7B\uFF1Avendor \u586B\u63D0\u4F9B\u798F\u5229\u7684\u5382\u5546\u6216\u4EA7\u54C1\u65B9\uFF08\u5982\u201CGoogle\u201D\u201Cpacket.ai\u201D\u201C\u67D0\u67D0\u516C\u76CA\u7AD9\u201D\uFF0C\u4E0D\u77E5\u9053\u586B null\uFF09\uFF1Bperk \u586B\u798F\u5229\u7C7B\u578B\uFF0C\u53EA\u80FD\u662F \u514D\u8D39\u989D\u5EA6 / \u9650\u65F6\u514D\u8D39 / \u8D60\u91D1 / \u4F18\u60E0\u7801 / \u514D\u8D39\u4F1A\u5458 / \u516C\u76CA\u7AD9 / \u5176\u5B83\u3002\u798F\u5229\u5DF2\u7ED3\u675F\u3001\u53EA\u6709\u4ED8\u8D39\u6298\u6263\u3001\u6216\u9700\u8981\u5148\u4ED8\u8D39\u7684\uFF0Crelevant \u586B false\u3002
\u8F93\u51FA\u683C\u5F0F\uFF1A{"results":[{"i":\u5E8F\u53F7,"relevant":true,"category":"\u5206\u7C7Bkey","obtain":"free","simple_signup":true,"signup":"\u6CE8\u518C\u8981\u6C42\uFF0C15\u5B57\u5185","name":"\u670D\u52A1\u6216\u8D44\u6E90\u540D\u79F0","summary":"\u9001\u4EC0\u4E48 + \u9650\u5236\uFF0C40\u5B57\u5185","how":"\u600E\u4E48\u9886\uFF0C20\u5B57\u5185","deadline":null,"vendor":null,"perk":null,"score":80}]}`;
async function judgeBatch(items, s, bad = []) {
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
      { role: "system", content: judgePrompt(s) + (bad.length ? `
\u7528\u6237\u53CD\u9988\u300C\u4E0D\u503C\u300D\u7684\u4F8B\u5B50\uFF08\u7C7B\u4F3C\u7684\u8BF7\u4ECE\u4E25\uFF0Crelevant \u586B false \u6216\u538B\u4F4E\u5206\u6570\uFF09\uFF1A
${bad.map((t) => "- " + String(t).slice(0, 60)).join("\n")}` : "") },
      { role: "user", content: JSON.stringify(payload) }
    ]
  });
  const j = extractJson(content);
  const results = Array.isArray(j) ? j : j.results || [];
  const map = /* @__PURE__ */ new Map();
  for (const r of results) if (r && Number.isInteger(Number(r.i))) map.set(Number(r.i), r);
  return map;
}

// src/fold.js
function foldItems(list) {
  const by = /* @__PURE__ */ new Map(), out = [];
  for (const it of list) {
    let extra = [];
    try {
      extra = JSON.parse(it.sources || "[]");
    } catch {
    }
    const key = it.target || it.url;
    const head = by.get(key);
    const mine = [{ n: it.source, u: it.url }, ...extra];
    if (head) {
      for (const x of mine) if (!head.srcs.some((y) => y.u === x.u)) head.srcs.push(x);
      continue;
    }
    const { target, sources, ...rest } = it;
    const o = { ...rest, srcs: mine };
    by.set(key, o);
    out.push(o);
  }
  for (const o of out) if (o.srcs.length < 2) delete o.srcs;
  else o.srcs = o.srcs.slice(0, 8);
  return out;
}

// src/mailer.js
var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var recipients = (s) => [...new Set(String(s || "").split(/[,;，；\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))].slice(0, 10);
var ymd = (t) => new Date(t + 8 * 36e5).toISOString().slice(0, 10);
var CAT2 = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
var OBTAIN_ZH2 = { free: "\u76F4\u63A5\u767D\u5AD6", conditional: "\u6709\u6761\u4EF6", lottery: "\u62BD\u5956", trial: "\u8BD5\u7528", promo: "\u63A8\u5E7F", paid: "\u9700\u4ED8\u8D39" };
async function collectDigest(env, s) {
  const onlyNew = s.mail_only_new !== "false";
  const since = onlyNew ? Number(s.mail_last_sent_at) || 0 : 0;
  const cutoff = Date.now() - (Number(s.max_age_days) || 180) * 864e5;
  const limit = Math.min(200, Number(s.mail_max_items) || 60);
  const cats = mailCats(s);
  const order = CATEGORIES.map((c, i) => `WHEN '${c.key}' THEN ${i}`).join(" ");
  const { results } = await env.DB.prepare(
    `SELECT * FROM items WHERE status = 'approved' AND dead = 0 AND (expires_at IS NULL OR expires_at > ${Date.now()}) AND COALESCE(judged_at, fetched_at) > ? AND (published_at IS NULL OR published_at >= ?)
     AND category IN (${cats.map(() => "?").join(",")})
     ORDER BY CASE category ${order} ELSE 99 END, COALESCE(published_at, fetched_at) DESC LIMIT ?`
  ).bind(since, cutoff, ...cats, limit).all();
  return foldItems(results || []);
}
var xo = (it) => {
  if (it._x) return it._x;
  let x = it.extra;
  if (typeof x === "string") {
    try {
      x = JSON.parse(x);
    } catch {
      x = null;
    }
  }
  return it._x = x || {};
};
function renderDigest(items, s, dateStr) {
  const groups = {};
  const freshMs = Math.max(1, Number(s.fresh_days) || 15) * 864e5;
  const oldKey = `\u8F83\u65E9\u53D1\u5E03\uFF08${Math.max(1, Number(s.fresh_days) || 15)} \u5929\u524D\uFF09`;
  for (const it of items) (groups[s._flat ? "_flat" : it.published_at && Date.now() - it.published_at > freshMs ? oldKey : it.category || "other"] ||= []).push(it);
  if (groups[oldKey]) {
    const o = groups[oldKey];
    delete groups[oldKey];
    groups[oldKey] = o;
  }
  const siteUrl = (s.mail_site_url || "").replace(/\/+$/, "");
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',Arial,sans-serif";
  const section = (cat, list) => `
${cat === "_flat" ? "" : `<tr><td style="padding:22px 24px 6px;font-family:${font};font-size:16px;font-weight:bold;color:#111827;border-bottom:1px solid #e6e8ec;">${CAT2[cat] || cat}\uFF08${list.length}\uFF09</td></tr>`}
${list.map((it) => `
<tr><td style="padding:14px 24px;border-bottom:1px solid #eeeeee;font-family:${font};">
  <a href="${esc(it.url)}" target="_blank" style="font-size:15px;font-weight:bold;color:#111318;text-decoration:none;line-height:1.5;word-break:break-all;">${esc(it.name || it.title)}</a>
  ${it.name && it.name !== it.title ? `<div style="font-size:12px;color:#9ca3af;line-height:1.5;margin-top:2px;">${esc(it.title)}</div>` : ""}
  ${it.summary ? `<div style="font-size:14px;color:#374151;line-height:1.6;margin-top:6px;">${esc(it.summary)}</div>` : ""}
  ${xo(it).how || it.expires_at || xo(it).codes ? `<div style="font-size:13px;color:#374151;line-height:1.6;margin-top:4px;">${xo(it).how ? "\u9886\u53D6\uFF1A" + esc(xo(it).how) + "&nbsp; " : ""}${it.expires_at ? `<span style="color:#b91c1c;">\u622A\u6B62 ${ymd(it.expires_at)}</span>&nbsp; ` : ""}${xo(it).codes ? "\u7801\uFF1A" + xo(it).codes.map((c) => `<code style="background:#f1f3f6;padding:1px 5px;border-radius:4px;font-family:Menlo,Consolas,monospace;">${esc(c)}</code>`).join(" ") : ""}</div>` : ""}
  <div style="font-size:12px;color:#6b7280;line-height:1.6;margin-top:6px;">
    ${it.obtain ? `<span style="color:${it.obtain === "free" ? "#047857" : "#92400e"};font-weight:bold;">${OBTAIN_ZH2[it.obtain] || ""}</span>&nbsp; ` : ""}${it.signup ? `<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:4px;">\u6CE8\u518C\uFF1A${esc(it.signup)}</span>&nbsp; ` : ""}
    ${it.published_at ? ymd(it.published_at) + " \xB7 " : ""}${esc(it.srcs ? it.srcs.map((x) => x.n).join(" / ") : it.source || "")}${it.score != null ? " \xB7 " + it.score + "\u5206" : ""}
  </div>
</td></tr>`).join("")}`;
  const body = items.length ? [...Object.keys(CAT2), oldKey, "_flat"].filter((c) => groups[c]).map((c) => section(c, groups[c])).join("") : `<tr><td style="padding:30px 24px;font-family:${font};font-size:14px;color:#6b7280;text-align:center;">\u4ECA\u5929\u6CA1\u6709\u65B0\u7684\u8D44\u6E90\u3002</td></tr>`;
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
<tr><td style="padding:22px 24px;background:#312e81;border-radius:8px 8px 0 0;font-family:${font};">
  <div style="font-size:19px;font-weight:bold;color:#ffffff;">${esc(s.mail_subject)}</div>
  <div style="font-size:13px;color:#d1d5db;margin-top:4px;">${dateStr} \xB7 \u5171 ${items.length} \u6761 \xB7 ${esc(s._sub || "\u53EA\u6536\u5F55\u534A\u5E74\u5185\u3001\u6CE8\u518C\u7B80\u5355\u7684\u514D\u8D39\u8D44\u6E90")}</div>
</td></tr>
${body}
<tr><td style="padding:18px 24px;font-family:${font};font-size:12px;color:#9ca3af;line-height:1.6;">
  ${siteUrl ? `<a href="${esc(siteUrl)}" target="_blank" style="color:#312e81;text-decoration:none;">\u67E5\u770B\u5168\u90E8\u8D44\u6E90 \u2192</a>&nbsp;\xB7&nbsp;<a href="${esc(siteUrl)}/feed.xml" target="_blank" style="color:#9ca3af;">RSS</a><br>` : ""}
  \u7531 Cloudflare Workers \u81EA\u52A8\u6293\u53D6\u5E76\u7ECF AI \u7B5B\u9009\uFF0C\u4F7F\u7528\u524D\u8BF7\u81EA\u884C\u786E\u8BA4\u670D\u52A1\u6761\u6B3E\u3002
</td></tr>
</table></td></tr></table></body></html>`;
  const text = [`${s.mail_subject} \xB7 ${dateStr} \xB7 \u5171 ${items.length} \u6761`, ""].concat(items.length ? [...Object.keys(CAT2), oldKey, "_flat"].filter((c) => groups[c]).flatMap((c) => [
    c === "_flat" ? "" : `\u3010${CAT2[c] || c}\u3011`,
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
async function sendMail(env, s, msg) {
  const all = recipients(s.mail_to);
  if (!all.length) throw new Error("\u672A\u586B\u5199\u6709\u6548\u7684\u6536\u4EF6\u4EBA");
  if (s.mail_separate === "false" || all.length === 1) return sendMailTo(env, s, msg, all);
  const ok = [], failed = [];
  for (const addr of all) {
    try {
      await sendMailTo(env, s, msg, [addr]);
      ok.push(addr);
    } catch (e) {
      failed.push(`${addr}\uFF1A${e.message}`);
    }
  }
  if (!ok.length) throw new Error(failed.join("\uFF1B"));
  return { provider: s.mail_provider || "smtp", to: ok, failed };
}
async function sendMailTo(env, s, { subject, html: html2, text }, to) {
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
    const tags = [CAT2[it.category] || "", it.obtain ? OBTAIN_ZH2[it.obtain] : "", it.signup ? `\u6CE8\u518C\uFF1A${it.signup}` : ""].filter(Boolean).join(" \xB7 ");
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
function channelsOf(env, s) {
  const mailReady = !!String(s.mail_to || "").trim() && (s.mail_provider === "smtp" || !s.mail_provider ? !!(s.smtp_user && s.smtp_pass) : s.mail_provider === "cloudflare" ? !!s.mail_from : !!(s.mail_api_key && s.mail_from));
  const tgReady = !!(s.telegram_bot_token && s.telegram_chat_id);
  return [s.mail_enabled === "true" && mailReady && "mail", s.telegram_enabled === "true" && tgReady && "telegram", ...PUSH_CHANNELS.filter((c) => pushReady(s, c)).map((c) => "push:" + c.id)].filter(Boolean);
}
async function deliver(env, s, { kind = "digest", title, items, channel, sub } = {}) {
  const channels = channel ? [channel] : channelsOf(env, s);
  if (!channels.length) return { skipped: "\u6CA1\u6709\u53EF\u7528\u7684\u63A8\u9001\u6E20\u9053\uFF08\u90AE\u4EF6\u9700\u586B\u5199\u8D26\u53F7\u3001\u6388\u6743\u7801\u548C\u6536\u4EF6\u4EBA\uFF0C\u6216\u914D\u7F6E Telegram / \u5FAE\u4FE1 / \u9489\u9489 / \u98DE\u4E66\u7B49\u673A\u5668\u4EBA\uFF09" };
  const dateStr = ymd(Date.now());
  const results = [], errors = [];
  for (const ch of channels) {
    try {
      if (ch === "mail") {
        const r = await sendMail(env, s, { subject: title, ...renderDigest(items, { ...s, mail_subject: title.replace(/ · \d{4}-\d{2}-\d{2}.*$/, ""), _flat: kind !== "digest", _sub: sub }, dateStr) });
        if (r.failed?.length) errors.push("\u90E8\u5206\u90AE\u4EF6\u5931\u8D25\uFF1A" + r.failed.join("\uFF1B"));
        results.push(r);
      } else if (ch === "telegram") results.push(await sendTelegram(s, items, title));
      else {
        const id = ch.slice(5);
        const r = await pushAll(s, title, items, id);
        if (r.ok.length) results.push({ provider: r.ok[0], to: [] });
        else errors.push(...r.errors);
      }
    } catch (e) {
      errors.push(`${ch === "mail" ? "\u90AE\u4EF6" : ch === "telegram" ? "Telegram" : ch}\uFF1A${e.message}`);
    }
  }
  if (!results.length) throw new Error(errors.join("\uFF1B"));
  return { sent: items.length, to: results.flatMap((r) => r.to || []), providers: results.map((r) => r.provider), errors };
}
async function sendDigest(env, { force = false, test = false, channel, label = "" } = {}) {
  const s = await getSettings(env);
  const startedAt = Date.now();
  if (!channel && !channelsOf(env, s).length) return { skipped: "\u6CA1\u6709\u53EF\u7528\u7684\u63A8\u9001\u6E20\u9053\uFF08\u90AE\u4EF6\u9700\u586B\u5199\u8D26\u53F7\u3001\u6388\u6743\u7801\u548C\u6536\u4EF6\u4EBA\uFF0C\u6216\u914D\u7F6E Telegram / \u5FAE\u4FE1 / \u9489\u9489 / \u98DE\u4E66\u7B49\u673A\u5668\u4EBA\uFF09" };
  const items = test ? (await collectDigest(env, { ...s, mail_only_new: "false" })).slice(0, 5) : await collectDigest(env, s);
  if (!test && !items.length && s.mail_send_empty !== "true") return { skipped: "\u6CA1\u6709\u65B0\u5185\u5BB9" };
  const dateStr = ymd(Date.now());
  const title = `${test ? "[\u6D4B\u8BD5] " : ""}${s.mail_subject} \xB7 ${dateStr}${label ? " " + label : ""}${items.length ? `\uFF08${items.length} \u6761\uFF09` : ""}`;
  const r = await deliver(env, s, { title, items, channel });
  if (!test && !r.skipped) await saveSettings(env, { mail_last_sent_at: String(startedAt) });
  return r;
}
async function sendWeekly(env, { channel, test = false } = {}) {
  const s = await getSettings(env);
  const { results } = await env.DB.prepare("SELECT * FROM items WHERE status = 'approved' AND dead = 0 AND COALESCE(published_at, fetched_at) >= ? ORDER BY score DESC LIMIT 400").bind(Date.now() - 7 * 864e5).all();
  const items = weeklyPicks(foldItems(results || []).map((it) => {
    try {
      it.extra = it.extra ? JSON.parse(it.extra) : null;
    } catch {
      it.extra = null;
    }
    return it;
  }));
  if (!items.length) return { skipped: "\u8FD9\u5468\u6CA1\u6709\u53EF\u9009\u7684\u6761\u76EE" };
  return deliver(env, s, { kind: "weekly", title: `${test ? "[\u6D4B\u8BD5] " : ""}\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE \xB7 \u672C\u5468\u7CBE\u9009 ${ymd(Date.now())}\uFF08${items.length} \u6761\uFF09`, items, channel, sub: "\u8FD1 7 \u5929\u7EFC\u5408 AI \u8BC4\u5206\u3001\u6295\u7968\u548C\u6765\u6E90\u6570\u6311\u51FA\u7684 10 \u6761" });
}

// src/search.js
var CJK = /[\u4e00-\u9fff]/;
function backendCats(s, id) {
  const all = enabledCats(s);
  const own = String(s[`${id}_cats`] || "").split(",").map((x) => x.trim()).filter(Boolean);
  return own.length ? all.filter((k) => own.includes(k)) : all;
}
function searchQueries(s, cats) {
  let qs = String(s.search_queries || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (!qs.length) qs = searchQueriesFor(cats || enabledCats(s));
  const lang = s.search_lang || "zh_first";
  if (lang === "zh_only") qs = qs.filter((q) => CJK.test(q));
  return qs.slice(0, Math.max(1, Number(s.search_max_queries) || 12));
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
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function runQueries(queries, fn, name, concurrency = 4) {
  const settled = [];
  const once = async (q) => {
    try {
      return await fn(q);
    } catch (e) {
      if (/HTTP 429/.test(e.message)) {
        await sleep(1500);
        return fn(q);
      }
      throw e;
    }
  };
  for (let i = 0; i < queries.length; i += concurrency) {
    if (i) await sleep(1100);
    settled.push(...await Promise.allSettled(queries.slice(i, i + concurrency).map(once)));
  }
  const ok = settled.filter((x) => x.status === "fulfilled");
  if (!ok.length && settled.length) throw settled[0].reason || new Error(`${name} \u5168\u90E8\u67E5\u8BE2\u5931\u8D25`);
  const errors = settled.filter((x) => x.status === "rejected").map((x) => x.reason?.message);
  return { items: ok.flatMap((x) => x.value), errors };
}
var sinceDate = (days) => new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
var pick = (r) => ({ title: r.title || r.url, url: r.url, published_at: r.published_at || null, raw_text: String(r.raw_text || "").slice(0, 1500) });
var parseTime = (v) => {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};
var BACKENDS = [
  {
    id: "anysearch",
    name: "AnySearch",
    keyless: true,
    zh: true,
    free: "\u514D Key \u6BCF\u5929 1000 \u6B21\uFF08\u6309 IP\uFF09\uFF1B\u6CE8\u518C\u540E\u6BCF\u5929 1000 \u6B21",
    signup: "https://www.anysearch.com",
    note: "\u4E2D\u6587\u7ED3\u679C\u597D\uFF08zone=cn\uFF09\uFF0C\u63A8\u8350",
    async search(s, query, days) {
      const headers = s.anysearch_api_key ? { Authorization: `Bearer ${s.anysearch_api_key}` } : {};
      const j = await postJson("https://api.anysearch.com/v1/search", headers, { query, max_results: Math.min(10, Number(s.search_max_results) || 10), zone: "cn" }, "AnySearch");
      if (j.code && j.code !== 0) throw new Error(`AnySearch ${j.code}: ${String(j.message || "").slice(0, 100)}`);
      return (j.data?.results || []).map((r) => pick({ title: r.title, url: r.url, raw_text: r.snippet || r.content }));
    }
  },
  {
    id: "keenable",
    name: "Keenable",
    keyless: true,
    free: "\u514D Key \u6BCF\u5C0F\u65F6 1000 \u6B21\uFF08\u6309 IP\uFF09\uFF1B\u6CE8\u518C\u540E\u6BCF\u6708 10 \u4E07\u6B21",
    signup: "https://keenable.ai",
    note: "\u652F\u6301\u6309\u53D1\u5E03\u65F6\u95F4\u8FC7\u6EE4",
    async search(s, query, days) {
      const key = s.keenable_api_key;
      const url = key ? "https://api.keenable.ai/v1/search" : "https://api.keenable.ai/v1/search/public";
      const headers = key ? { "X-API-Key": key } : { "X-Keenable-Title": "Free Resource Radar" };
      const body = { query, mode: s.keenable_mode || "pro", max_results: Math.min(50, Number(s.search_max_results) || 10), published_after: `${days}d`, snippet_max_length: 800, disable_cards: true };
      const ex = blockList(s);
      if (ex.length) body.exclude_domains = ex;
      const j = await postJson(url, headers, body, "Keenable");
      return (j.results || []).map((r) => pick({ title: r.title, url: r.url, published_at: parseTime(r.published_at), raw_text: r.snippet }));
    }
  },
  {
    id: "tavily",
    name: "Tavily",
    keyless: false,
    free: "\u6BCF\u6708 1000 credits\uFF0C\u4E0D\u7528\u7ED1\u5361",
    signup: "https://app.tavily.com",
    note: "\u4E2D\u6587\u67E5\u8BE2\u81EA\u52A8 language=zh-cn",
    async search(s, query, days) {
      const body = { query, search_depth: s.tavily_depth || "basic", max_results: Math.min(20, Number(s.search_max_results) || 10), topic: "general", auto_parameters: false, start_date: sinceDate(days), filter_by_published_date: true, include_published_date: true, include_answer: false, include_raw_content: false };
      const ex = blockList(s).slice(0, 150);
      if (ex.length) body.exclude_domains = ex;
      if (CJK.test(query) && (s.search_lang || "zh_only") !== "any") {
        body.language = "zh-cn";
        if ((s.search_lang || "zh_only") === "zh_only") body.filter_by_language = true;
      }
      const j = await postJson("https://api.tavily.com/search", { Authorization: `Bearer ${s.tavily_api_key}` }, body, "Tavily");
      return (j.results || []).map((r) => pick({ title: r.title, url: r.url, published_at: parseTime(r.published_date), raw_text: r.content }));
    }
  },
  {
    id: "exa",
    name: "Exa",
    keyless: false,
    free: "\u6CE8\u518C\u9001 $10\uFF0C\u6BCF\u6708 1 \u65E5\u91CD\u7F6E\u4E3A $10\uFF08\u7EA6 1400 \u6B21 lite \u641C\u7D22\uFF09",
    signup: "https://dashboard.exa.ai",
    note: "",
    async search(s, query, days) {
      const body = { query, type: "lite", numResults: Math.min(10, Number(s.search_max_results) || 10), startPublishedDate: new Date(Date.now() - days * 864e5).toISOString(), contents: { highlights: true } };
      const j = await postJson("https://api.exa.ai/search", { "x-api-key": s.exa_api_key }, body, "Exa");
      return (j.results || []).map((r) => pick({ title: r.title, url: r.url, published_at: parseTime(r.publishedDate), raw_text: (r.highlights || []).join(" ") || r.text }));
    }
  },
  {
    id: "brave",
    name: "Brave Search",
    keyless: false,
    free: "\u6BCF\u6708\u81EA\u52A8\u8D60\u9001 $5 \u989D\u5EA6\uFF08\u7EA6 1000 \u6B21\uFF09",
    signup: "https://api-dashboard.search.brave.com",
    note: "",
    async search(s, query, days) {
      const fresh = days <= 1 ? "pd" : days <= 7 ? "pw" : days <= 31 ? "pm" : "py";
      const qs = new URLSearchParams({ q: query, count: String(Math.min(20, Number(s.search_max_results) || 10)), freshness: fresh });
      if (CJK.test(query)) qs.set("search_lang", "zh-hans");
      const r = await fetch(`https://api.search.brave.com/res/v1/web/search?${qs}`, { headers: { "X-Subscription-Token": s.brave_api_key, Accept: "application/json" }, signal: AbortSignal.timeout(3e4) });
      const text = await r.text();
      if (!r.ok) throw new Error(`Brave HTTP ${r.status}: ${text.slice(0, 200)}`);
      const j = JSON.parse(text);
      return (j.web?.results || []).map((x) => pick({ title: x.title, url: x.url, raw_text: [x.description, ...x.extra_snippets || []].join(" ").replace(/<[^>]+>/g, "") }));
    }
  },
  {
    id: "qianfan",
    name: "\u767E\u5EA6\u5343\u5E06\u641C\u7D22",
    keyless: false,
    zh: true,
    free: "\u6BCF\u6708 1500 \u6B21\uFF08\u7EA6\u6BCF\u5929 50 \u6B21\uFF09\uFF0C\u9700\u5B9E\u540D\u5F00\u901A",
    signup: "https://cloud.baidu.cn/doc/qianfan/s/nmweljpt3",
    note: "\u767E\u5EA6\u4E2D\u6587\u7ED3\u679C",
    async search(s, query, days) {
      const recency = days <= 7 ? "week" : days <= 31 ? "month" : days <= 183 ? "semiyear" : "year";
      const body = { messages: [{ role: "user", content: query }], search_source: "baidu_search_v2", edition: "standard", resource_type_filter: [{ type: "web", top_k: Math.min(20, Number(s.search_max_results) || 10) }], search_recency_filter: recency };
      const j = await postJson("https://qianfan.baidubce.com/v2/ai_search/web_search", { Authorization: `Bearer ${s.qianfan_api_key}` }, body, "\u767E\u5EA6\u5343\u5E06");
      if (j.code && !j.references) throw new Error(`\u767E\u5EA6\u5343\u5E06 ${j.code}: ${String(j.message || "").slice(0, 100)}`);
      return (j.references || []).map((r) => pick({ title: r.title, url: r.url, published_at: parseTime(r.date), raw_text: r.snippet || r.content }));
    }
  },
  {
    id: "volc",
    name: "\u706B\u5C71\u5F15\u64CE\u8054\u7F51\u641C\u7D22",
    keyless: false,
    zh: true,
    free: "\u6BCF\u6708 500 \u6B21\uFF0C\u9700\u5F00\u901A\u670D\u52A1",
    signup: "https://docs.volcengine.com/docs/networked-search/networked-search?lang=zh",
    note: "\u6296\u97F3 / \u5934\u6761\u7CFB\u4E2D\u6587\u7ED3\u679C",
    async search(s, query, days) {
      const range = days <= 1 ? "OneDay" : days <= 7 ? "OneWeek" : days <= 31 ? "OneMonth" : "OneYear";
      const body = { Query: query.slice(0, 100), SearchType: "web", Count: Math.min(50, Number(s.search_max_results) || 10), TimeRange: range, Filter: { NeedUrl: true }, QueryControl: { QueryRewrite: false } };
      const j = await postJson("https://open.feedcoopapi.com/search_api/web_search", { Authorization: `Bearer ${s.volc_api_key}` }, body, "\u706B\u5C71\u5F15\u64CE");
      const err = j.ResponseMetadata?.Error;
      if (err) throw new Error(`\u706B\u5C71\u5F15\u64CE ${err.Code || ""}: ${String(err.Message || "").slice(0, 100)}`);
      return (j.Result?.WebResults || []).map((r) => pick({ title: r.Title, url: r.Url, published_at: parseTime(r.PublishTime), raw_text: r.Summary || r.Snippet }));
    }
  }
];
var BACKEND_MAP = Object.fromEntries(BACKENDS.map((b) => [b.id, b]));
var backendReady = (s, b) => s[`${b.id}_enabled`] === "true" && (b.keyless || !!s[`${b.id}_api_key`]);
async function runBackend(s, id, maxAgeDays) {
  const b = BACKEND_MAP[id];
  if (!b) throw new Error(`\u672A\u77E5\u641C\u7D22\u540E\u7AEF\uFF1A${id}`);
  if (!b.keyless && !s[`${id}_api_key`]) throw new Error(`\u672A\u586B\u5199 ${b.name} \u7684 API Key`);
  const cats = backendCats(s, id);
  if (!cats.length) return { items: [], errors: [], skipped: "\u8D1F\u8D23\u7684\u5206\u7C7B\u90FD\u6CA1\u6709\u52FE\u9009" };
  const r = await runQueries(searchQueries(s, cats), (q) => b.search(s, q, maxAgeDays), b.name);
  for (const it of r.items) it.source = `${b.name} \u641C\u7D22`;
  return r;
}
async function searchForDiscovery(s, queries) {
  const ready = BACKENDS.filter((b) => backendReady(s, b)).slice(0, 2);
  if (!ready.length) return { results: [], errors: ["\u6CA1\u6709\u53EF\u7528\u7684\u641C\u7D22\u540E\u7AEF\uFF0C\u53BB\u300CAI \u4E0E\u641C\u7D22\u300D\u6253\u5F00\u4E00\u4E2A"] };
  const results = [], errors = [];
  const jobs = ready.flatMap((b) => queries.map((q) => b.search(s, q, 3650).then((l) => results.push(...l), (e) => errors.push(`${b.name}\uFF1A${e.message}`))));
  await Promise.all(jobs);
  return { results, errors };
}

// src/rules.js
var NOISE_TITLE = /^(怎样|怎么|如何|哪里|哪个|为什么|为何)|请问|有没有|求推荐|求一个|哪里(有|能)|值得买吗|怎么样[?？]|不够用|用完了|失效了|吐槽|踩坑|后悔|失望|谁有|求个|求购|哪有|多少钱|求助|求带|有人吗|有人知道|被封|封号|跑路|[?？]\s*$/;
function isNoiseTitle(title) {
  const t = String(title || "");
  if (/^(如何|怎么|怎样)/.test(t) && /教程|攻略|步骤|指南/.test(t) && !/请问|求助|有没有|失效|[?？]/.test(t)) return false;
  return NOISE_TITLE.test(t);
}
var stripNegated = (t) => String(t || "").replace(/(无需|不需要|不需|不用|无须|免|不必|没有|no|without)\s*(绑定|绑)?\s*(信用卡|银行卡|绑卡|卡|实名|手机号?验证|手机号|短信验证|邀请码|充值|付费|kyc|credit card|phone verification)/gi, " ");
function guessObtain(title, summary = "") {
  const t = stripNegated(`${title} ${summary}`);
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
    const line2 = raw.trim();
    if (!line2 || line2.startsWith("#")) continue;
    const m = line2.match(/^\/(.+)\/([gimsuy]*)$/);
    if (m) {
      try {
        rules.push({ label: line2, test: (s) => new RegExp(m[1], m[2].replace("g", "")).test(s) });
      } catch {
      }
    } else {
      const w = line2.toLowerCase();
      rules.push({ label: line2, test: (s) => s.toLowerCase().includes(w) });
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
var SITE_TAIL = /(社区|论坛|博客|官网|网站|频道|之家|周刊|日报|资讯|新闻网|科技|分享|软件|吧|网|blog|news|forum|community)$/i;
var KNOWN_TAIL = /\s*[-_|｜–—]\s*(腾讯云开发者社区(-腾讯云)?|阿里云开发者社区|博客园|CSDN博客|CSDN|知乎专栏|知乎|掘金|简书|51CTO博客|开源中国|哔哩哔哩|bilibili|今日头条|网易|搜狐|新浪科技|IT之家|cnBeta\.COM|cnBeta)\s*$/i;
function cleanTitle(title, source = "", url = "") {
  let t = String(title || "").replace(/[\u3000\s]+/g, " ").trim();
  t = t.replace(/^(【\s*(转|转载|转帖|原创|分享|置顶|推荐)\s*】|\[\s*(转|转载|原创|分享|置顶)\s*\]|(转载|转帖)[:：])\s*/, "");
  t = t.replace(KNOWN_TAIL, "").trim();
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").split(".")[0].toLowerCase();
  } catch {
  }
  const src = String(source || "").split(/[·\s|]/)[0].trim().toLowerCase();
  for (let k = 0; k < 2; k++) {
    const m = /\s*(?:\s[-–—|]\s|_|｜)\s*([^-–—|_｜]{2,24})$/.exec(t);
    if (!m) break;
    const tail = m[1].trim(), low = tail.toLowerCase();
    if (/免费|白嫖|领取|限免|赠送|送|额度|教程|下载/.test(tail)) break;
    if (!(SITE_TAIL.test(tail) || src && (low.includes(src) || src.includes(low)) || host && host.length > 2 && low.replace(/[^a-z0-9]/g, "").includes(host))) break;
    if (m.index < 6) break;
    t = t.slice(0, m.index).trim();
  }
  return t.replace(/\s*[（(](转载|转|原创)[)）]\s*$/, "").trim();
}
var BJ = 8 * 36e5;
var endOfDay = (y, m, d) => {
  const t = Date.UTC(y, m - 1, d, 23, 59, 59) - BJ;
  return Number.isFinite(t) && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? t : null;
};
function extractDeadline(text, publishedAt, now = Date.now()) {
  const s = String(text || "").slice(0, 1500);
  if (!s) return null;
  const base = publishedAt || now;
  const baseYear = new Date(base + BJ).getUTCFullYear();
  const cands = [];
  const KW = "(?:\u622A\u6B62|\u622A\u81F3|\u7ED3\u675F|\u5230\u671F|\u6709\u6548\u671F\u81F3|\u6709\u6548\u671F\u5230|\u6D3B\u52A8\u65F6\u95F4|\u9886\u53D6\u65F6\u95F4|\u9650\u65F6|until|ends?|end date|expires?|deadline|before)";
  let m;
  const range = /(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?[^\n]{0,20}?(?:至|到|~|～|—)\s*(?:(20\d{2})[-/.年])?(\d{1,2})[-/.月](\d{1,2})日?/g;
  let rest = s;
  while (m = range.exec(s)) {
    cands.push(endOfDay(Number(m[4] || m[1]), Number(m[5]), Number(m[6])));
    rest = rest.replace(m[0], " ");
  }
  const full = new RegExp(KW + "[^\\n]{0,30}?(20\\d{2})[-/.\u5E74](\\d{1,2})[-/.\u6708](\\d{1,2})|(20\\d{2})[-/.\u5E74](\\d{1,2})[-/.\u6708](\\d{1,2})\u65E5?\\s*(?:\\d{1,2}:\\d{2}(?::\\d{2})?)?\\s*(?:\u524D|\u4E4B\u524D|\u622A\u6B62|\u7ED3\u675F|\u5230\u671F|\u6B62)", "gi");
  while (m = full.exec(rest)) cands.push(endOfDay(Number(m[1] || m[4]), Number(m[2] || m[5]), Number(m[3] || m[6])));
  const md = new RegExp(KW + "[^\\n\\d]{0,12}(\\d{1,2})\u6708(\\d{1,2})[\u65E5\u53F7]|(\\d{1,2})\u6708(\\d{1,2})[\u65E5\u53F7]\\s*(?:\\d{1,2}[:\u70B9]\\d{0,2})?\\s*(?:\u524D|\u4E4B\u524D|\u622A\u6B62|\u7ED3\u675F|\u5230\u671F|\u6B62)", "g");
  while (m = md.exec(rest)) {
    const mo = Number(m[1] || m[3]), d = Number(m[2] || m[4]);
    let t = endOfDay(baseYear, mo, d);
    if (t && t < base - 30 * 864e5) t = endOfDay(baseYear + 1, mo, d);
    cands.push(t);
  }
  const nd = /(?:限时|仅剩|只剩|还剩|剩余)\s*(\d{1,2})\s*天/.exec(rest);
  if (nd) cands.push(base + Number(nd[1]) * 864e5);
  const ok = cands.filter((t) => t && t > base - 864e5 && t < now + 400 * 864e5);
  return ok.length ? Math.min(...ok) : null;
}
function extractCodes(text) {
  const s = String(text || "").slice(0, 2e3);
  const out = [];
  const re = /(?:兑换码|激活码|注册码|优惠码|折扣码|序列号|口令|礼包码|(?<![a-z])(?:cdkey|cd-key|promo code|coupon code|redeem code|license key|serial|code)(?![a-z]))\s*[:：为是]?\s*[「“"'`(（]?\s*([A-Z0-9][A-Z0-9-]{4,38}[A-Z0-9])/gi;
  let m;
  while ((m = re.exec(s)) && out.length < 5) {
    const c = m[1];
    if (!/\d/.test(c) && !/^[A-Z0-9]{3,}(-[A-Z0-9]{3,}){2,}$/i.test(c)) continue;
    if (/^(http|www|20\d{2}-\d)/i.test(c) || /^\d{1,6}$/.test(c) || /[a-z]/.test(c) && /[A-Z]/.test(c) && c.length < 10) continue;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}
function firstSentence(text, n = 90) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const m = /^(.{12,}?[。！？!?；;])/.exec(t.slice(0, n + 40));
  const s = m && m[1].length <= n ? m[1] : t.slice(0, n);
  return s.length < t.length && !/[。！？!?；;]$/.test(s) ? s.replace(/[，,、\s]+$/, "") + "\u2026" : s;
}

// src/crawler.js
var UA = "Mozilla/5.0 (compatible; FreeResourceRadar/1.0; +https://workers.cloudflare.com)";
var DAY2 = 864e5;
async function getText(url, headers = {}, maxBytes = 0) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "*/*", ...headers },
    signal: AbortSignal.timeout(2e4)
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (!maxBytes || !r.body) return r.text();
  const reader = r.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  reader.cancel().catch(() => {
  });
  const buf = new Uint8Array(Math.min(size, maxBytes));
  let off = 0;
  for (const c of chunks) {
    const part = c.subarray(0, buf.length - off);
    buf.set(part, off);
    off += part.length;
    if (off >= buf.length) break;
  }
  return new TextDecoder().decode(buf);
}
var getJson = async (url, headers) => JSON.parse(await getText(url, { Accept: "application/json", ...headers }));
var ENT = { nbsp: " ", quot: '"', apos: "'", lt: "<", gt: ">", amp: "&" };
function decodeEntities(s) {
  s = String(s || "");
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|nbsp|quot|apos|lt|gt|amp);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return String.fromCodePoint(n);
      } catch {
        return m;
      }
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
function cleanText(s) {
  let t = String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  t = decodeEntities(t);
  t = t.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  return decodeEntities(t).replace(/\s+/g, " ").trim();
}
function tag(block, name) {
  const lower = block;
  let i = 0;
  for (; ; ) {
    i = lower.indexOf("<" + name, i);
    if (i < 0) return "";
    const ch = lower[i + name.length + 1];
    if (ch === ">" || ch === " " || ch === "\n" || ch === "	" || ch === "\r" || ch === "/") break;
    i += name.length + 1;
  }
  const gt = block.indexOf(">", i);
  if (gt < 0 || block[gt - 1] === "/") return "";
  const end = block.indexOf("</" + name + ">", gt);
  return end < 0 ? "" : block.slice(gt + 1, end);
}
function targetKey(u) {
  try {
    const x = new URL(normalizeUrl(u));
    for (const k of [...x.searchParams.keys()]) if (/^(aff|aff_code|ref|refer|referral|invite|invite_code|inviter|via|from|share|channel|code)$/i.test(k)) x.searchParams.delete(k);
    return (x.hostname.replace(/^(www|m)\./, "").toLowerCase() + x.pathname.replace(/\/+$/, "") + x.search).slice(0, 300);
  } catch {
    return String(u || "").slice(0, 300);
  }
}
var mergeSources = (a, b) => {
  const out = [...a];
  for (const x of b) if (!out.some((y) => y.u === x.u)) out.push(x);
  return out.slice(0, 12);
};
function parseTelegram(html2, ch) {
  const out = [];
  const parts = html2.split('class="tgme_widget_message_wrap');
  for (let i = parts.length - 1; i >= 1 && out.length < 30; i--) {
    const b = parts[i];
    const post2 = /data-post="([^"]+)"/.exec(b);
    const tm = b.indexOf("tgme_widget_message_text");
    if (!post2 || tm < 0) continue;
    const st = b.indexOf(">", tm) + 1;
    const end = b.indexOf("</div>", st);
    const textHtml = b.slice(st, end < 0 ? st + 4e3 : end).replace(/<br\s*\/?>/gi, "\n");
    const text = decodeEntities(textHtml.replace(/<[^>]+>/g, "")).replace(/[ \t]+/g, " ").trim();
    if (!text) continue;
    const first = text.split("\n").map((x) => x.trim()).find((x) => x.length > 1) || text;
    const dt = /datetime="([^"]+)"/.exec(b);
    const link = /<a[^>]+href="(https?:\/\/(?!t\.me)[^"]+)"/.exec(b.slice(st, end));
    out.push({
      title: first.replace(/^[^\p{L}\p{N}【\[（(]+/u, "").slice(0, 120),
      url: `https://t.me/${post2[1]}`,
      published_at: dt ? parseDate(dt[1]) : null,
      raw_text: (text.slice(0, 1200) + (link ? `
\u94FE\u63A5\uFF1A${decodeEntities(link[1])}` : "")).slice(0, 1500),
      target: link ? decodeEntities(link[1]) : null
      // 频道消息指向的原文，用来和其它来源合并
    });
  }
  return out;
}
function parseDate(s) {
  if (!s) return null;
  const t = Date.parse(String(s).replace(/<!\[CDATA\[|\]\]>/g, "").trim());
  return Number.isFinite(t) ? t : null;
}
function parseFeed(xml) {
  const open = xml.includes("<item") ? "item" : "entry";
  const out = [];
  let i = 0;
  while (out.length < 200) {
    i = xml.indexOf("<" + open, i);
    if (i < 0) break;
    const c = xml[i + open.length + 1];
    if (c !== ">" && c !== " " && c !== "\n" && c !== "\r" && c !== "	") {
      i += 2;
      continue;
    }
    const end = xml.indexOf("</" + open + ">", i);
    if (end < 0) break;
    const b = xml.slice(i, end);
    i = end + open.length + 3;
    let link = cleanText(tag(b, "link"));
    if (!link) {
      const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || b.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = alt ? decodeEntities(alt[1]) : cleanText(tag(b, "guid"));
    }
    const body = tag(b, "description") || tag(b, "summary") || tag(b, "content:encoded") || tag(b, "content");
    const plain2 = cleanText(body.slice(0, 2e3));
    const tags = [];
    for (let k = b.indexOf("<category"); k >= 0 && tags.length < 8; k = b.indexOf("<category", k + 9)) {
      const gt = b.indexOf(">", k), e = b.indexOf("</category>", gt);
      if (gt < 0 || e < 0 || b[gt - 1] === "/") {
        const m = /term=["']([^"']+)/.exec(b.slice(k, gt + 1));
        if (m) tags.push(decodeEntities(m[1]));
        continue;
      }
      tags.push(cleanText(b.slice(gt + 1, e)));
    }
    out.push({
      tags,
      title: cleanText(tag(b, "title")),
      url: link,
      published_at: parseDate(tag(b, "pubDate") || tag(b, "published") || tag(b, "dc:date") || tag(b, "updated")),
      raw_text: plain2.slice(0, 1200),
      target: contentTarget(body.slice(0, 4e3), link)
    });
  }
  const n = {};
  for (const x of out) if (x.target) n[x.target] = (n[x.target] || 0) + 1;
  for (const x of out) if (x.target && n[x.target] > 1) x.target = null;
  return out;
}
var SKIP_TARGET = /(^|\.)(twitter\.com|x\.com|facebook\.com|weibo\.com|t\.me|telegram\.me|gravatar\.com|creativecommons\.org|feedburner\.com|wordpress\.org|wp\.com|qr\.|github\.com$)/i;
function contentTarget(html2, self) {
  if (!html2) return null;
  let own = "";
  try {
    own = new URL(self).hostname.replace(/^www\./, "");
  } catch {
  }
  const re = /href=(?:"|'|&quot;|&#34;|&#x22;)(https?:\/\/[^"'<>\s]+?)(?:"|'|&quot;|&#34;|&#x22;)/gi;
  let m, k = 0;
  while ((m = re.exec(html2)) && k++ < 12) {
    const u = decodeEntities(m[1]);
    let h;
    try {
      const x = new URL(u);
      h = x.hostname.replace(/^www\./, "");
      if (x.pathname.length < 2 && !x.search) continue;
    } catch {
      continue;
    }
    if (!h || h === own || h.endsWith("." + own) || own.endsWith("." + h)) continue;
    if (SKIP_TARGET.test(h) || /\.(png|jpe?g|gif|webp|svg|mp4|mp3)(\?|$)/i.test(u) || /\/(share|sharer|intent|tag|category|author)\b/i.test(u)) continue;
    return u;
  }
  return null;
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
var GH = { "User-Agent": "Mozilla/5.0 (compatible; FreeResourceRadar/1.0)" };
async function ghCommits(repo) {
  const xml = await getText(`https://github.com/${repo}/commits.atom`, { ...GH, Accept: "application/atom+xml" }, 8e4);
  const out = [];
  for (const b of xml.split("<entry>").slice(1)) {
    const sha = (/Commit\/([0-9a-f]{40})/.exec(b) || [])[1];
    if (sha) out.push({ sha, title: cleanText(tag(b, "title")), date: parseDate(tag(b, "updated")), link: `https://github.com/${repo}/commit/${sha}` });
  }
  return out;
}
async function ghPatch(repo, sha) {
  try {
    return await getText(`https://github.com/${repo}/commit/${sha}.patch`, { ...GH, Accept: "text/plain" }, 16e4);
  } catch {
    return getText(`https://github.com/${repo}/commit/${sha}.patch`, { ...GH, Accept: "text/plain" }, 16e4);
  }
}
function addedLines(patch, pathRe) {
  const out = [];
  let file = "", ok = false;
  for (const l of patch.split("\n")) {
    if (l.startsWith("diff --git ")) {
      file = l.split(" b/").pop() || "";
      ok = pathRe.test(file);
      continue;
    }
    if (ok && l.startsWith("+") && !l.startsWith("+++")) out.push(l.slice(1));
  }
  return out;
}
var MD_LINK = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
var GENERIC_LINK = /^(注册链接|注册|链接|官网|官网链接|地址|入口|官方入口|官方来源|官方链接|官方页|官方页面|官方文档|文档|公告|活动公告|活动页|专属链接|点击|访问|前往|link|website|docs|官方|source|源码|github|详情|官方免费层|免费层|试用|限时|限时免费|永久免费|试用 \/ 限时权益|有效|待核实|已失效)$/i;
var mdPlain = (x) => decodeEntities(x.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(MD_LINK, "$1").replace(/<[^>]+>/g, " ").replace(/[*_`>#]|:[a-z0-9_+-]+:/g, "").replace(/\s+/g, " ")).trim();
function lineToItem(line2) {
  const l = line2.trim();
  if (l.length < 6 || /^#|^\|?\s*:?-{3}|^<!--|^>|^(POST|GET|curl)\s/i.test(l)) return null;
  const links = [...l.matchAll(MD_LINK)].filter((m) => !/^!/.test(l.slice(Math.max(0, m.index - 1), m.index))).map((m) => ({ t: mdPlain(m[1]), u: m[2] }));
  if (!links.length) {
    const m = /https?:\/\/[^\s|)<>"'`，。；]+/.exec(l);
    if (m) links.push({ t: "", u: m[0].replace(/[.,;:!?]+$/, "") });
  }
  const pick2 = links.find((x) => !/\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(x.u) && !/shields\.io|badge|camo\.|\/\/github\.com\/[^/]+\/?$|\/\/github\.com\/[^/]+\/[^/]+\/(issues|pulls|blob|tree)/i.test(x.u));
  if (!pick2) return null;
  let name, summary;
  if (l.startsWith("|")) {
    const cells = l.split("|").slice(1, -1).map(mdPlain).filter(Boolean);
    const useful = cells.filter((x) => !/^[\d.\s]+$/.test(x) && !/^\d{4}[-/.]\d{1,2}([-/.]\d{1,2})?$/.test(x) && !GENERIC_LINK.test(x) && !/^https?:/i.test(x) && !/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(x) && !/^[✅❌⚠️✔️✖️🟢🔴🟡\s]+$/u.test(x));
    if (!useful.length) return null;
    name = useful[0];
    summary = useful.slice(1).sort((a, b) => b.length - a.length)[0] || "";
  } else {
    const p = mdPlain(l.replace(/^[-*+]\s+|^\d+\.\s+/, ""));
    name = pick2.t && !GENERIC_LINK.test(pick2.t) ? pick2.t : p.split(/[：:，,。\-–—|]/)[0].trim();
    summary = p.replace(name, "").replace(/^[\s:：\-–—|,，]+/, "").trim();
  }
  name = String(name || "").trim();
  if (name.length > 30) {
    const cut = name.search(/[：:，,。；;（(]/);
    name = cut >= 4 && cut <= 30 ? name.slice(0, cut) : name.slice(0, 30) + "\u2026";
  }
  if (name.length < 2) return null;
  return { title: (summary ? `${name}\uFF1A${summary}` : name).slice(0, 160), name, url: pick2.u, summary: summary.slice(0, 200), raw_text: mdPlain(l).slice(0, 600) };
}
async function countNodes(url) {
  const t = await getText(url, { Accept: "text/plain, */*" }, 15e4);
  const more = t.length >= 149e3;
  if (/^\s*(proxies:|port:|mixed-port:|allow-lan:|mode:|#)/m.test(t.slice(0, 3e3))) return { n: (t.match(/^\s*-\s*(\{\s*)?name:/gm) || []).length, more };
  let body = t;
  if (!/:\/\//.test(t.slice(0, 500))) {
    try {
      body = atob(t.replace(/\s+/g, "").slice(0, more ? Math.floor(t.replace(/\s+/g, "").length / 4) * 4 : void 0));
    } catch {
      body = t;
    }
  }
  return { n: (body.match(/^(vmess|vless|trojan|ss|ssr|hysteria2?|hy2|tuic|wireguard|socks5?|http|https|anytls):\/\//gim) || []).length, more };
}
async function fetchRepo(src, env) {
  const repo = String(src.repo || "").replace(/^https?:\/\/github\.com\//, "").replace(/\.git$|\/+$/g, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("repo \u5E94\u5199\u6210 owner/name");
  const commits = await ghCommits(repo);
  if (!commits.length) return [];
  if (src.mode === "sub") {
    const c0 = commits[0];
    const subs = (src.subs || []).slice(0, 6);
    let nodes = null, more = false;
    if (subs[0]) {
      try {
        const r = await countNodes(subs[0][1]);
        nodes = r.n;
        more = r.more;
      } catch {
      }
    }
    return [{
      title: `${src.name || repo} \xB7 \u514D\u8D39\u8282\u70B9\u8BA2\u9605`,
      name: src.name || repo,
      url: `https://github.com/${repo}`,
      published_at: c0.date,
      upsert: true,
      summary: `\u6700\u8FD1\u66F4\u65B0\uFF1A${c0.title}`.slice(0, 200),
      raw_text: `${c0.title} \u514D\u8D39\u8282\u70B9\u8BA2\u9605`,
      extra: { subs, commit: c0.link, nodes, nodes_more: more || void 0 }
    }];
  }
  const key = "gh:" + repo;
  const last = await getMeta(env, key);
  const at = last ? commits.findIndex((c) => c.sha === last) : -1;
  let fresh = !last ? commits.slice(0, 2) : at < 0 ? commits.slice(0, 3) : commits.slice(0, at);
  fresh = fresh.slice(0, Math.min(5, Number(src.max_commits) || 3));
  let pathRe = /\.(md|markdown)$/i;
  if (src.path) {
    try {
      pathRe = new RegExp(src.path, "i");
    } catch {
    }
  }
  const out = [];
  for (const c of fresh) {
    const added = addedLines(await ghPatch(repo, c.sha), pathRe);
    if (added.length > 400) continue;
    for (const l of added) {
      const it = lineToItem(l);
      if (it) out.push({ ...it, published_at: c.date, raw_text: `${it.raw_text}\uFF08\u6765\u81EA ${repo} \u7684\u63D0\u4EA4\uFF1A${c.title}\uFF09`.slice(0, 900) });
      if (out.length >= 40) break;
    }
  }
  await setMeta(env, key, commits[0].sha);
  return out;
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
    case "gamerpower": {
      const j = await getJson(`https://www.gamerpower.com/api/giveaways?type=${encodeURIComponent(src.kind || "game")}`);
      if (!Array.isArray(j)) return [];
      return j.filter((g) => g.status !== "Expired").map((g) => ({
        title: `${g.title}\uFF08${g.platforms || ""}\uFF09`,
        url: g.open_giveaway_url || g.gamerpower_url,
        published_at: parseDate(String(g.published_date || "").replace(" ", "T") + "Z"),
        raw_text: `${cleanText(g.description).slice(0, 400)} \u539F\u4EF7 ${g.worth || "N/A"}${g.end_date && g.end_date !== "N/A" ? "\uFF0C\u622A\u6B62 " + g.end_date : ""}`,
        name: g.title,
        summary: `${g.platforms || ""} \u514D\u8D39\u9886\u53D6${g.worth && g.worth !== "N/A" ? "\uFF0C\u539F\u4EF7 " + g.worth : ""}${g.end_date && g.end_date !== "N/A" ? "\uFF0C\u622A\u6B62 " + g.end_date.slice(0, 10) : ""}`,
        signup: (g.platforms || "").split(",")[0].trim() + " \u8D26\u53F7"
      }));
    }
    case "epic": {
      const j = await getJson("https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=zh-CN&country=CN&allowCountries=CN");
      const out = [];
      for (const e of j?.data?.Catalog?.searchStore?.elements || []) {
        const offers = (e.promotions?.promotionalOffers || []).flatMap((g) => g.promotionalOffers || []);
        const free = offers.find((o) => o.discountSetting?.discountPercentage === 0);
        if (!free) continue;
        const slug = e.catalogNs?.mappings?.[0]?.pageSlug || e.productSlug || e.urlSlug;
        const end = parseDate(free.endDate);
        out.push({
          title: `Epic \u514D\u8D39\u9886\u53D6\uFF1A${e.title}`,
          url: slug ? `https://store.epicgames.com/p/${slug}` : "https://store.epicgames.com/free-games",
          published_at: parseDate(free.startDate) || Date.now(),
          raw_text: cleanText(e.description || "").slice(0, 400),
          name: e.title,
          summary: `Epic \u9650\u65F6\u514D\u8D39\uFF0C\u9886\u53D6\u540E\u6C38\u4E45\u5165\u5E93${end ? "\uFF0C\u622A\u6B62 " + dayOf(end) : ""}`,
          signup: "Epic \u8D26\u53F7"
        });
      }
      return out;
    }
    case "openrouter_free": {
      const j = await getJson("https://openrouter.ai/api/v1/models?max_price=0");
      return (j.data || []).filter((m) => String(m.id).endsWith(":free")).map((m) => ({
        title: `OpenRouter \u514D\u8D39\u6A21\u578B\uFF1A${m.name}`,
        url: `https://openrouter.ai/${String(m.id)}`,
        published_at: (m.created || 0) * 1e3 || null,
        raw_text: cleanText(String(m.description || "").slice(0, 600)).slice(0, 400),
        name: m.name,
        summary: `OpenRouter \u4E0A\u7684\u514D\u8D39\u6A21\u578B\uFF0CAPI \u8C03\u7528\u4E0D\u8BA1\u8D39\uFF08\u6709\u9891\u7387\u9650\u5236\uFF09${m.context_length ? "\uFF0C\u4E0A\u4E0B\u6587 " + Math.round(m.context_length / 1e3) + "K" : ""}`,
        signup: "\u90AE\u7BB1 / GitHub / Google"
      }));
    }
    case "repo":
      return fetchRepo(src, env);
    case "telegram": {
      const ch = String(src.channel || "").replace(/^@/, "").trim();
      if (!/^\w{4,}$/.test(ch)) throw new Error("\u7F3A\u5C11 channel");
      return parseTelegram(await getText(`https://t.me/s/${ch}`, { Accept: "text/html" }, 3e5), ch);
    }
    case "rss":
    default:
      if (!src.url) throw new Error("\u7F3A\u5C11 url");
      return parseFeed(await getText(src.url, { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" }, 12e4));
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
var csv = (v) => (Array.isArray(v) ? v : String(v || "").split(",")).map((x) => String(x).trim()).filter(Boolean);
function allowedOf(item, cats) {
  const own = csv(item.cats);
  return own.length ? cats.filter((k) => own.includes(k)) : cats;
}
function heuristicJudge(item, s) {
  const text = stripNegated(`${item.title} ${item.raw_text || ""}`).toLowerCase();
  const hard = s.simple_signup_only !== "false" && lines(s.hard_signup_keywords).find((w) => text.includes(w));
  const obtain = guessObtain(item.title, item.raw_text || "");
  const allowed = lines(s.allowed_obtain);
  const allow = allowedOf(item, enabledCats(s));
  const category = guessCategory(text, allow) || (item.hint && allow.includes(item.hint) ? item.hint : null) || "other";
  if (isInfoCat(category) && item.hint === category) return { status: "approved", obtain: null, category, name: null, summary: firstSentence(item.raw_text, 90), signup: null, score: null, judged_by: "keywords" };
  const asking = /^(求|请问|问下|问一下|有没有|求助|求推荐)|[？?]\s*$/.test(String(item.title || "").trim());
  return {
    // 没有 AI 时更保守：标题里要有“免费 / 白嫖 / free”之类的字样；提问帖不收
    status: asking || hard || !(allowed.includes(obtain) || category === "aideal" && obtain === "trial") || category === "other" || !lines(s.free_keywords).some((w) => kwHit(String(item.title).toLowerCase(), w)) ? "rejected" : "approved",
    obtain,
    category,
    name: null,
    summary: firstSentence(item.raw_text, 100),
    signup: hard ? `\u7591\u4F3C\u9700\u8981\uFF1A${hard}` : allowed.includes(obtain) ? null : `\u83B7\u53D6\u65B9\u5F0F\uFF1A${obtain}`,
    score: null,
    judged_by: "keywords"
  };
}
var DOUBT = /抽奖|开奖|转发|付费|充值|折扣|打折|优惠码|优惠券|半价|首月|首年|低至|特价|促销|秒杀|续费|年付|月付|季付|限量|名额|内测资格|邀请码|aff|推广|广告|招聘|求助|请问|求推荐|有没有|怎么|吗[？?]?$|[？?]$|[$¥￥]\s?\d|\d+(\.\d+)?\s*(元|美元|欧元|rmb|usd)(?![a-z])/i;
function triage(item, s) {
  const h = heuristicJudge(item, s);
  if (isInfoCat(h.category) && item.hint === h.category) return { verdict: h, sure: true };
  const title = String(item.title || "").toLowerCase();
  const text = `${title} ${String(item.raw_text || "").slice(0, 400).toLowerCase()}`;
  if (h.status === "approved" && h.obtain === "free" && !DOUBT.test(title) && !DOUBT.test(String(item.raw_text || "").slice(0, 200))) return { verdict: { ...h, score: 70, judged_by: "auto" }, sure: true };
  if (h.obtain === "paid" && !lines(s.free_keywords).some((w) => kwHit(text, w))) return { verdict: { ...h, status: "rejected", judged_by: "auto" }, sure: true };
  if (/^(求|请问|问下|有没有|求助)|[？?]\s*$/.test(String(item.title || "").trim())) return { verdict: { ...h, status: "rejected", signup: "\u63D0\u95EE\u5E16", judged_by: "auto" }, sure: true };
  return { verdict: h, sure: false };
}
var ZERO_STATS = () => ({ auto: 0, cached: 0, dead: 0, watched: 0, skipped_src: 0, merged: 0, fetched: 0, blocked: 0, block_rule: 0, noise: 0, dup_title: 0, non_zh: 0, hard_signup: 0, too_old: 0, undated: 0, off_topic: 0, candidates: 0, new: 0, trusted: 0, judged: 0, approved: 0, rejected: 0, expired_removed: 0, errors: 0 });
var aiReadyOf = (s) => s.ai_enabled !== "false" && !!(s.ai_api_key && s.ai_base_url && s.ai_model);
function ctxOf(s, now) {
  const maxAgeDays = Math.max(1, Number(s.max_age_days) || 180);
  const cats = enabledCats(s);
  return {
    s,
    now,
    maxAgeDays,
    cats,
    cutoff: now - maxAgeDays * DAY2,
    keepUndated: s.keep_undated === "true",
    topicRe: compileWords([...topicWordsFor(cats), ...lines(s.topic_keywords)]),
    freeWords: lines(s.free_keywords),
    hardWords: lines(s.hard_signup_keywords),
    blockDomains: lines(s.search_block_domains),
    searchLang: s.search_lang || "zh_first",
    blockRules: compileBlockRules(s.block_rules),
    noiseOn: s.noise_filter !== "false",
    noEnglish: s.filter_english !== "false",
    aiReady: aiReadyOf(s)
  };
}
function listSources(s, aiReady, log) {
  let sources = [];
  try {
    sources = JSON.parse(s.sources).filter((x) => x && x.enabled !== false);
  } catch (e) {
    log.push(`\u2717 \u6570\u636E\u6E90 JSON \u89E3\u6790\u5931\u8D25\uFF1A${e.message}`);
  }
  const skipped = sources.filter((x) => x.ai_only && !aiReady);
  if (skipped.length) log.push(`\u2013 \u672A\u914D\u7F6E AI\uFF0C\u8DF3\u8FC7 ${skipped.length} \u4E2A\u566A\u97F3\u8F83\u5927\u7684\u6E90\uFF08${skipped.map((x) => x.name).join("\u3001")}\uFF09`);
  return sources.filter((x) => !(x.ai_only && !aiReady));
}
var RADAR_SKIP = /怎么选|如何选|对比|评测|常见问题|差多少|该不该|是什么|有哪些|哪个好|值得|吗[？?]?\s*$|[？?]\s*$|速率限制|限制详解|使用限制|教程|入门|#shorts|\br\/\w+|套餐\s*[|｜]|pricing|价格/i;
async function ingest(env, c, src, items, stats, log) {
  const cats = c.cats;
  const autoCat = src.category === "auto";
  if (src.trusted && src.category && !autoCat && !cats.includes(src.category)) {
    log.push(`\u2013 ${src.name}: \u5206\u7C7B\u300C${CAT_MAP[src.category]?.label}\u300D\u672A\u52FE\u9009\uFF0C\u8DF3\u8FC7`);
    return;
  }
  const own = csv(src.cats);
  const allow = own.length ? cats.filter((k) => own.includes(k)) : cats;
  if (own.length && !allow.length) {
    log.push(`\u2013 ${src.name}: \u8D1F\u8D23\u7684\u5206\u7C7B\u90FD\u6CA1\u6709\u52FE\u9009\uFF0C\u8DF3\u8FC7`);
    return;
  }
  if (src.trusted && src.category && !autoCat && own.length && !allow.includes(src.category)) {
    log.push(`\u2013 ${src.name}: \u56FA\u5B9A\u5206\u7C7B\u4E0D\u5728\u5B83\u8D1F\u8D23\u7684\u5206\u7C7B\u91CC\uFF0C\u8DF3\u8FC7`);
    return;
  }
  const wantTags = csv(src.tags), skipTags = csv(src.skip_tags);
  if (items.length > 30) items = items.slice(0, 30);
  if (wantTags.length || skipTags.length) items = items.filter((x) => {
    const t = x.tags || [];
    if (wantTags.length && !t.some((y) => wantTags.includes(y))) {
      stats.off_topic++;
      return false;
    }
    if (skipTags.some((y) => t.includes(y))) {
      stats.off_topic++;
      return false;
    }
    return true;
  });
  let include = null;
  if (src.include) {
    try {
      include = new RegExp(src.include, "i");
    } catch {
      log.push(`! ${src.name}: include \u6B63\u5219\u65E0\u6548`);
    }
  }
  const candidates = /* @__PURE__ */ new Map();
  const runFp = /* @__PURE__ */ new Map();
  if (Number(src.limit) > 0) items = items.slice().sort((a, b) => (b.published_at || 0) - (a.published_at || 0)).slice(0, Number(src.limit));
  for (const raw of items) {
    const it = { ...raw, source: raw.source || src.name || src.type, trusted: !!src.trusted, category: src.category || null, cats: own.length ? allow.join(",") : null, hint: src.hint || src.fallback || null };
    if (src.note && !it.summary) it.summary = src.note;
    it.title = cleanTitle(it.title, it.source, it.url);
    if (autoCat) {
      const g = guessCategory(`${it.title} ${it.raw_text || ""}`.toLowerCase(), allow) || src.fallback;
      if (!g || !allow.includes(g)) {
        stats.off_topic++;
        continue;
      }
      it.category = g;
    }
    stats.fetched++;
    if (!it.url || !it.title) continue;
    if (include && !include.test(it.title)) {
      stats.off_topic++;
      continue;
    }
    if (!it.published_at) {
      if (!c.keepUndated && !src.isSearch) {
        stats.undated++;
        continue;
      }
    } else if (it.published_at < c.cutoff) {
      stats.too_old++;
      continue;
    }
    if (isBlocked(it.url, c.blockDomains)) {
      stats.blocked++;
      continue;
    }
    if (c.noiseOn && isNoiseTitle(it.title)) {
      stats.noise++;
      continue;
    }
    if (c.noEnglish && !CJK2.test(it.title) && !CJK2.test(it.summary || "") && !CJK2.test(String(it.raw_text || "").slice(0, 500))) {
      stats.non_zh++;
      continue;
    }
    if (c.blockRules.length && matchBlock(c.blockRules, `${it.title}
${it.raw_text || ""}`)) {
      stats.block_rule++;
      continue;
    }
    if (src.radar && RADAR_SKIP.test(it.title)) {
      stats.off_topic++;
      continue;
    }
    if (src.isSearch) {
      if (c.s.search_strict !== "false" && !c.freeWords.some((w) => kwHit(it.title.toLowerCase(), w))) {
        stats.off_topic++;
        continue;
      }
      const zh = it.lang ? it.lang.startsWith("zh") : CJK2.test(it.title);
      if (c.searchLang === "zh_only" && !zh) {
        stats.non_zh++;
        continue;
      }
      const t = `${it.title} ${it.raw_text || ""}`.toLowerCase();
      if (c.s.simple_signup_only !== "false" && c.hardWords.some((w) => t.includes(w) && !t.includes("\u65E0\u9700" + w) && !t.includes("\u4E0D\u9700\u8981" + w) && !t.includes("no " + w))) {
        stats.hard_signup++;
        continue;
      }
    }
    if (src.filter !== false && !src.trusted) {
      const text = `${it.title} ${it.raw_text || ""}`.toLowerCase();
      if (!(c.topicRe && c.topicRe.test(text)) || !containsAny(text, c.freeWords)) {
        stats.off_topic++;
        continue;
      }
      if (own.length) {
        const g = guessCategory(text, cats);
        if (g && !allow.includes(g)) {
          stats.off_topic++;
          continue;
        }
      }
    }
    const url = normalizeUrl(it.url);
    const id = await hashId(url);
    const fp = titleFingerprint(it.title);
    if (candidates.has(id)) continue;
    const tkey = targetKey(it.target || url);
    const twin = fp.length >= 8 && runFp.get(fp) || [...candidates.values()].find((x) => x.tkey === tkey || x.target && targetKey(x.url) === tkey);
    if (twin) {
      twin.also = mergeSources(twin.also || [], [{ n: it.source, u: url }]);
      stats.merged++;
      continue;
    }
    const cand = { ...it, url, id, fp, tkey };
    if (fp.length >= 8) runFp.set(fp, cand);
    candidates.set(id, cand);
  }
  stats.candidates += candidates.size;
  if (!candidates.size) return;
  const ids = [...candidates.keys()];
  const existing = /* @__PURE__ */ new Set();
  const existingFp = /* @__PURE__ */ new Set();
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
  const byTarget = /* @__PURE__ */ new Map();
  const byFp = /* @__PURE__ */ new Map();
  const tkeys = [...new Set([...candidates.values()].flatMap((x) => [x.tkey, targetKey(x.url)]))];
  for (let i = 0; i < tkeys.length; i += 90) {
    const chunk = tkeys.slice(i, i + 90);
    const { results: rows } = await env.DB.prepare(`SELECT id, target, source, url, sources FROM items WHERE target IN (${chunk.map(() => "?").join(",")})`).bind(...chunk).all();
    for (const row of rows || []) if (!byTarget.has(row.target)) byTarget.set(row.target, row);
  }
  const fpList = [...new Set([...candidates.values()].map((x) => x.fp).filter((f) => f && f.length >= 8))];
  for (let i = 0; i < fpList.length; i += 90) {
    const chunk = fpList.slice(i, i + 90);
    const { results: rows } = await env.DB.prepare(`SELECT id, fp, target, source, url, sources FROM items WHERE fp IN (${chunk.map(() => "?").join(",")})`).bind(...chunk).all();
    for (const row of rows || []) if (!byFp.has(row.fp)) byFp.set(row.fp, row);
  }
  const today = dayOf(c.now);
  const stmts = [];
  for (const [id, it] of candidates) {
    if (it.upsert) {
      stats.new += existing.has(id) ? 0 : 1;
      stmts.push(
        env.DB.prepare(`INSERT INTO items (id, title, url, source, raw_text, published_at, fetched_at, status, fp, day, category, name, summary, obtain, score, judged_by, judged_at, target, extra) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', NULL, ?, ?, ?, ?, 'free', 80, 'trusted', ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET title = excluded.title, summary = excluded.summary, extra = excluded.extra, published_at = excluded.published_at, fetched_at = excluded.fetched_at, judged_at = excluded.judged_at, day = excluded.day, status = 'approved' WHERE items.published_at IS NOT excluded.published_at OR items.extra IS NOT excluded.extra`).bind(id, it.title.slice(0, 500), it.url, it.source || "", (it.raw_text || "").slice(0, 2e3), it.published_at || c.now, c.now, today, it.category, it.name || null, it.summary || null, c.now, it.tkey, JSON.stringify(it.extra || {})),
        env.DB.prepare("INSERT OR IGNORE INTO seen (id, fp, seen_at) VALUES (?, ?, ?)").bind(id, null, c.now)
      );
      continue;
    }
    if (existing.has(id)) continue;
    const prev = byTarget.get(it.tkey) || byTarget.get(targetKey(it.url)) || (it.fp && it.fp.length >= 8 ? byFp.get(it.fp) : null);
    if (prev && prev.id !== id) {
      let list = [];
      try {
        list = JSON.parse(prev.sources || "[]");
      } catch {
      }
      list = mergeSources(list, [{ n: it.source, u: it.url }, ...it.also || []].filter((x) => x.u !== prev.url));
      prev.sources = JSON.stringify(list);
      stmts.push(env.DB.prepare("UPDATE items SET sources = ? WHERE id = ?").bind(prev.sources, prev.id), env.DB.prepare("INSERT OR IGNORE INTO seen (id, fp, seen_at) VALUES (?, ?, ?)").bind(id, it.fp || null, c.now));
      stats.merged++;
      continue;
    }
    if (it.fp && it.fp.length >= 8 && existingFp.has(it.fp)) {
      stats.dup_title++;
      continue;
    }
    stats.new++;
    const blob = `${it.title}
${it.summary || ""}
${it.raw_text || ""}`;
    const exp = extractDeadline(blob, it.published_at, c.now);
    const codes = extractCodes(blob);
    const ex0 = codes.length ? { codes } : {};
    if (it.trusted && (it.category === "ai" || it.category === "aideal")) {
      const txt = `${it.name || ""} ${it.title} ${it.summary || ""} ${String(it.raw_text || "").slice(0, 300)}`;
      ex0.vendor = guessVendor(it.name || it.title) || guessVendor(txt) || void 0;
      ex0.perk = guessPerk(txt) || void 0;
    }
    const extra = Object.keys(ex0).some((k) => ex0[k] !== void 0) ? JSON.stringify(ex0) : null;
    const direct = it.trusted && it.category;
    if (direct && isInfoCat(it.category) && !it.summary) it.summary = firstSentence(it.raw_text, 90);
    if (direct) {
      stats.trusted++;
      stats.approved++;
    }
    stmts.push(
      direct ? env.DB.prepare("INSERT OR IGNORE INTO items (id, title, url, source, raw_text, published_at, fetched_at, status, fp, day, category, name, summary, signup, obtain, score, judged_by, judged_at, target, sources, expires_at, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, it.title.slice(0, 500), it.url, it.source || "", (it.raw_text || "").slice(0, 2e3), it.published_at || null, c.now, "approved", it.fp || null, today, it.category, it.name || null, it.summary || firstSentence(it.raw_text, 100), it.signup || null, isInfoCat(it.category) ? null : "free", 80, "trusted", c.now, it.tkey, it.also ? JSON.stringify(it.also) : null, exp, extra) : env.DB.prepare("INSERT OR IGNORE INTO items (id, title, url, source, raw_text, published_at, fetched_at, status, fp, day, cats, hint, target, sources, expires_at, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, it.title.slice(0, 500), it.url, it.source || "", (it.raw_text || "").slice(0, 2e3), it.published_at || null, c.now, "pending", it.fp || null, today, it.cats || null, it.hint || null, it.tkey, it.also ? JSON.stringify(it.also) : null, exp, extra),
      env.DB.prepare("INSERT OR IGNORE INTO seen (id, fp, seen_at) VALUES (?, ?, ?)").bind(id, it.fp || null, c.now)
    );
  }
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
}
async function judgeStep(env, c, stats, log, judgedSoFar, capOverride) {
  const s = c.s;
  const perStep = c.aiReady ? Math.min(20, Math.max(1, Number(s.ai_batch_size) || 12)) * 3 : 15;
  const cap = c.aiReady ? capOverride || Math.max(1, Number(s.ai_max_items) || 60) : 1e5;
  const room = Math.max(0, cap - judgedSoFar);
  if (!room) {
    log.push(`\u2013 \u672C\u6B21 AI \u5224\u5B9A\u5DF2\u8FBE\u4E0A\u9650 ${cap} \u6761\uFF0C\u5269\u4F59\u7559\u5230\u4E0B\u6B21`);
    return false;
  }
  const { results: pending } = await env.DB.prepare(
    "SELECT * FROM items WHERE status = ? AND (published_at IS NULL OR published_at >= ?) ORDER BY published_at DESC LIMIT ?"
  ).bind("pending", c.cutoff, Math.min(perStep, room) + 1).all();
  const list = (pending || []).slice(0, Math.min(perStep, room));
  if (!list.length) return false;
  const updates = [];
  const applyVerdict = (it, v) => {
    let ex = null;
    try {
      ex = it.extra ? JSON.parse(it.extra) : null;
    } catch {
    }
    if (v.how) ex = { ...ex || {}, how: String(v.how).slice(0, 40) };
    if (v.status === "approved" && (v.category === "ai" || v.category === "aideal")) {
      const txt = `${v.name || ""} ${it.title} ${v.summary || ""}`;
      ex = { ...ex || {}, vendor: String(v.vendor || guessVendor(it.title) || guessVendor(txt) || "").slice(0, 24) || void 0, perk: String(v.perk || guessPerk(txt) || "").slice(0, 8) || void 0 };
    }
    const exp = v.expires_at || it.expires_at || null;
    updates.push(
      env.DB.prepare("UPDATE items SET status=?, category=?, name=?, summary=?, signup=?, score=?, obtain=?, judged_by=?, judged_at=?, expires_at=?, extra=? WHERE id=?").bind(v.status, v.category, v.name, v.summary, v.signup, v.score, v.obtain || null, v.judged_by, Date.now(), exp, ex ? JSON.stringify(ex) : null, it.id)
    );
    stats.judged++;
    if (v.status === "approved") stats.approved++;
    else stats.rejected++;
  };
  if (c.aiReady) {
    const minScore = Number(s.ai_min_score) || 60;
    const allowedObtain = lines(s.allowed_obtain);
    const batchSize = Math.min(20, Math.max(1, Number(s.ai_batch_size) || 12));
    let aiItems = list.filter((it) => it.attempts < 3);
    for (const it of list.filter((x) => x.attempts >= 3)) applyVerdict(it, heuristicJudge(it, s));
    if (s.ai_review !== "all" && !capOverride) {
      const rest = [];
      for (const it of aiItems) {
        const t = triage(it, s);
        if (t.sure && !String(it.source || "").startsWith("AI \u798F\u5229\u96F7\u8FBE")) {
          applyVerdict(it, t.verdict);
          stats.auto++;
        } else rest.push(it);
      }
      aiItems = rest;
    }
    const useCache = s.ai_cache !== "false" && !capOverride;
    if (useCache && aiItems.length) {
      const keys = [...new Set(aiItems.map((it) => it.target).filter(Boolean))];
      const hit = /* @__PURE__ */ new Map();
      for (let i = 0; i < keys.length; i += 90) {
        const chunk = keys.slice(i, i + 90);
        const { results: rows } = await env.DB.prepare(`SELECT k, v FROM verdicts WHERE k IN (${chunk.map(() => "?").join(",")})`).bind(...chunk).all();
        for (const r of rows || []) {
          try {
            hit.set(r.k, JSON.parse(r.v));
          } catch {
          }
        }
      }
      if (hit.size) {
        const rest = [];
        for (const it of aiItems) {
          const v = it.target && hit.get(it.target);
          if (v) {
            applyVerdict(it, { ...v, judged_by: "cache" });
            stats.cached = (stats.cached || 0) + 1;
          } else rest.push(it);
        }
        aiItems = rest;
      }
    }
    let bad = [];
    if (aiItems.length) {
      const { results: rows } = await env.DB.prepare("SELECT title FROM items WHERE down >= 2 AND down > up ORDER BY judged_at DESC LIMIT 6").all().catch(() => ({ results: [] }));
      bad = (rows || []).map((r) => r.title);
    }
    const cacheWrites = [];
    const batches = [];
    for (let i = 0; i < aiItems.length; i += batchSize) batches.push(aiItems.slice(i, i + batchSize));
    await Promise.all(batches.map(async (batch) => {
      try {
        const verdicts = await judgeBatch(batch, s, bad);
        batch.forEach((it, idx) => {
          const v = verdicts.get(idx);
          if (!v) {
            updates.push(env.DB.prepare("UPDATE items SET attempts = attempts + 1 WHERE id=?").bind(it.id));
            return;
          }
          const score = Math.round(Number(v.score) || 0);
          const obtain = ["free", "conditional", "lottery", "trial", "promo", "paid"].includes(v.obtain) ? v.obtain : guessObtain(it.title, it.raw_text || "");
          const allow = allowedOf(it, c.cats);
          let category = allow.includes(v.category) ? v.category : "other";
          if (category === "other" && (!v.category || v.category === "other") && it.hint && allow.includes(it.hint)) category = it.hint;
          const signupOk = s.simple_signup_only === "false" || v.simple_signup === true;
          const ok = v.relevant === true && signupOk && category !== "other" && score >= minScore && (isInfoCat(category) || allowedObtain.includes(obtain) || category === "aideal" && obtain === "trial");
          const dl = /^(20\d{2})-(\d{2})-(\d{2})$/.exec(String(v.deadline || ""));
          const expires_at = dl ? Date.UTC(+dl[1], +dl[2] - 1, +dl[3], 15, 59, 59) : null;
          const verdict = {
            status: ok ? "approved" : "rejected",
            category,
            name: v.name ? String(v.name).slice(0, 100) : null,
            summary: v.summary ? String(v.summary).slice(0, 300) : null,
            signup: v.signup ? String(v.signup).slice(0, 100) : null,
            score,
            obtain,
            judged_by: `ai:${s.ai_model}`,
            how: v.how ? String(v.how).slice(0, 40) : null,
            vendor: v.vendor && v.vendor !== "null" ? String(v.vendor).slice(0, 24) : null,
            perk: v.perk && v.perk !== "null" ? String(v.perk).slice(0, 8) : null,
            expires_at: expires_at && expires_at > Date.now() - 30 * DAY2 && expires_at < Date.now() + 400 * DAY2 ? expires_at : null
          };
          applyVerdict(it, verdict);
          if (s.ai_cache !== "false" && it.target) cacheWrites.push(env.DB.prepare("INSERT INTO verdicts (k, v, at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, at = excluded.at").bind(it.target, JSON.stringify({ ...verdict, judged_by: void 0 }), Date.now()));
        });
      } catch (e) {
        stats.errors++;
        log.push(`\u2717 AI \u5224\u5B9A\u5931\u8D25\uFF1A${e.message}`);
        for (const it of batch) updates.push(env.DB.prepare("UPDATE items SET attempts = attempts + 1 WHERE id=?").bind(it.id));
      }
    }));
    updates.push(...cacheWrites);
  } else {
    for (const it of list) applyVerdict(it, heuristicJudge(it, s));
  }
  for (let i = 0; i < updates.length; i += 50) await env.DB.batch(updates.slice(i, i + 50));
  return (pending || []).length > list.length || c.aiReady && list.length === perStep;
}
async function cleanupStep(env, c, stats) {
  const keepMs = Math.max(1, Number(c.s.retention_days) || 15) * DAY2;
  const del = await env.DB.prepare("DELETE FROM items WHERE fetched_at < ? OR (published_at IS NOT NULL AND published_at < ?)").bind(c.now - keepMs, c.cutoff).run();
  stats.expired_removed += del.meta?.changes || 0;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM seen WHERE seen_at < ?").bind(Math.min(c.cutoff, c.now - keepMs)),
    env.DB.prepare("DELETE FROM verdicts WHERE at < ?").bind(c.cutoff),
    env.DB.prepare("DELETE FROM votes WHERE at < ?").bind(c.now - keepMs - 7 * DAY2),
    env.DB.prepare("DELETE FROM src_health WHERE day < ?").bind(dayOf(c.now - 30 * DAY2)),
    env.DB.prepare("DELETE FROM rate WHERE reset < ?").bind(c.now),
    env.DB.prepare("DELETE FROM jobs WHERE run_id IN (SELECT id FROM runs WHERE started_at < ?)").bind(c.now - 2 * DAY2),
    env.DB.prepare("DELETE FROM runs WHERE started_at < ?").bind(c.now - keepMs)
  ]);
}
var DEAD_RE = /活动已结束|活动结束|已结束|已失效|已下架|已领完|已抢光|已售罄|已停止|已关闭注册|停止注册|页面不存在|帖子不存在|主题不存在|内容已删除|已被删除|404 not found|page not found|has ended|giveaway ended|offer expired|no longer available|expired/i;
var SKIP_CHECK = /(^|\.)(t\.me|telegram\.me|github\.com|raw\.githubusercontent\.com|store\.epicgames\.com|reddit\.com|x\.com|twitter\.com)$/i;
async function checkLink(url) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  if (SKIP_CHECK.test(host)) return null;
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA, Accept: "text/html,*/*" }, signal: AbortSignal.timeout(1e4) });
    if (r.status === 404 || r.status === 410) {
      r.body?.cancel().catch(() => {
      });
      return 1;
    }
    if (!r.ok || !/html/i.test(r.headers.get("content-type") || "")) {
      r.body?.cancel().catch(() => {
      });
      return null;
    }
    const reader = r.body.getReader();
    let html2 = "", size = 0;
    while (size < 3e4) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      html2 += new TextDecoder().decode(value, { stream: true });
    }
    reader.cancel().catch(() => {
    });
    const pick2 = [/<title[^>]*>([\s\S]{0,300}?)<\/title>/i, /<meta[^>]+(?:name|property)=["'](?:description|og:title|og:description)["'][^>]+content=["']([^"']{0,300})/i, /<h1[^>]*>([\s\S]{0,300}?)<\/h1>/i].map((re) => (re.exec(html2) || [])[1] || "").join(" ");
    return DEAD_RE.test(cleanText(pick2)) ? 1 : 0;
  } catch {
    return null;
  }
}
async function checkStep(env, c, stats, log) {
  if (c.s.link_check === "false") return false;
  const n = Math.min(30, Math.max(1, Number(c.s.link_check_per_run) || 12));
  const info = Object.keys(CAT_MAP).filter((k) => isInfoCat(k));
  const { results: rows } = await env.DB.prepare(
    `SELECT id, url FROM items WHERE status = 'approved' AND (checked_at IS NULL OR checked_at < ?) AND (category IS NULL OR category NOT IN (${info.map(() => "?").join(",")})) ORDER BY checked_at IS NOT NULL, checked_at, published_at DESC LIMIT ?`
  ).bind(c.now - 3 * DAY2, ...info, n).all();
  if (!rows?.length) return false;
  const res = await Promise.all(rows.map((r) => checkLink(r.url)));
  const now = Date.now();
  await env.DB.batch(rows.map((r, i) => env.DB.prepare("UPDATE items SET checked_at = ?, dead = CASE WHEN ? IS NULL THEN dead ELSE ? END WHERE id = ?").bind(now, res[i], res[i] ?? 0, r.id)));
  const dead = res.filter((x) => x === 1).length;
  stats.dead += dead;
  log.push(`\u2713 \u5931\u6548\u68C0\u6D4B\uFF1A\u62BD\u67E5 ${rows.length} \u6761\uFF0C${dead} \u6761\u7591\u4F3C\u5931\u6548\uFF0C${res.filter((x) => x === null).length} \u6761\u6253\u4E0D\u5F00\uFF08\u4E0D\u8BA1\u5165\uFF09`);
  return false;
}
async function watchStep(env, c, stats, log) {
  const s = c.s;
  const kws = lines(s.watch_keywords);
  if (s.watch_enabled === "false" || !kws.length) return false;
  const since = Number(await getMeta(env, "watch_last")) || c.now - DAY2;
  const now = Date.now();
  const { results: rows } = await env.DB.prepare("SELECT id, title, name, summary, url, category, obtain, expires_at FROM items WHERE status = 'approved' AND judged_at > ? ORDER BY judged_at DESC LIMIT 300").bind(since).all();
  await setMeta(env, "watch_last", now);
  const hits = [];
  for (const r of rows || []) {
    const t = `${r.name || ""} ${r.title} ${r.summary || ""}`.toLowerCase();
    const k = kws.find((w) => kwHit(t, w));
    if (k) hits.push({ ...r, summary: `\u3010${k}\u3011${r.summary || ""}` });
  }
  if (!hits.length) return false;
  stats.watched += hits.length;
  try {
    const r = await deliver(env, s, { kind: "alert", title: `\u5173\u952E\u8BCD\u63D0\u9192\uFF1A${[...new Set(hits.map((h) => /^【([^】]+)】/.exec(h.summary)[1]))].join("\u3001")}\uFF08${hits.length} \u6761\uFF09`, items: hits.slice(0, 20) });
    log.push(r.skipped ? `\u2013 \u5173\u952E\u8BCD\u63D0\u9192\uFF1A${r.skipped}` : `\u2713 \u5173\u952E\u8BCD\u63D0\u9192\uFF1A${hits.length} \u6761 \u2192 ${r.providers.join(" + ")}${r.errors.length ? "\n\u2717 " + r.errors.join("\n\u2717 ") : ""}`);
  } catch (e) {
    log.push(`\u2717 \u5173\u952E\u8BCD\u63D0\u9192\u53D1\u9001\u5931\u8D25\uFF1A${e.message}`);
  }
  return false;
}
var STEP_LABEL = { source: "\u6293\u53D6", search: "\u641C\u7D22", radar: "AI \u798F\u5229\u96F7\u8FBE", judge: "\u5224\u5B9A", cleanup: "\u6E05\u7406", mail: "\u63A8\u9001", check: "\u5931\u6548\u68C0\u6D4B", watch: "\u5173\u952E\u8BCD\u63D0\u9192" };
async function planRun(env, trigger = "cron", opts = {}) {
  const now = Date.now();
  const active = await env.DB.prepare("SELECT id, started_at FROM runs WHERE finished_at IS NULL ORDER BY id DESC LIMIT 1").first();
  if (active && now - active.started_at < 3 * 36e5) return { run_id: active.id, existing: true };
  if (active) await env.DB.prepare("UPDATE runs SET finished_at = ?, log = log || ? WHERE id = ?").bind(now, "\n\u2717 \u8D85\u65F6\u672A\u5B8C\u6210\uFF0C\u5DF2\u653E\u5F03", active.id).run();
  const s = await getSettings(env);
  const log = [];
  const aiReady = aiReadyOf(s);
  let sources = listSources(s, aiReady, log);
  if (trigger !== "manual" && sources.some((x) => Number(x.every) > 0)) {
    const { results: rows } = await env.DB.prepare("SELECT name, MAX(last_at) AS t FROM src_health GROUP BY name").all();
    const last = Object.fromEntries((rows || []).map((r2) => [r2.name, r2.t || 0]));
    const skip = sources.filter((x) => Number(x.every) > 0 && now - (last[x.name] || 0) < Number(x.every) * 36e5 - 30 * 6e4);
    if (skip.length) {
      log.push(`\u2013 \u9519\u5CF0\uFF1A${skip.length} \u4E2A\u6E90\u8FD8\u6CA1\u5230\u6293\u53D6\u95F4\u9694\uFF0C\u8FD9\u4E00\u8F6E\u8DF3\u8FC7`);
      sources = sources.filter((x) => !skip.includes(x));
    }
  }
  const steps = opts.only === "judge" ? [] : sources.map((src) => ["source", { src }]);
  if (opts.only === "judge") {
    steps.push(["judge", { cap: opts.cap || 0 }]);
  } else {
    const ready = BACKENDS.filter((b) => backendReady(s, b)).map((b) => b.id);
    const perBackend = Math.max(1, Number(s.search_max_queries) || 8);
    const group = 1;
    for (let i = 0; i < ready.length; i += group) steps.push(["search", { engines: ready.slice(i, i + group) }]);
    const cats = enabledCats(s);
    if (s.aifree_radar !== "false" && ready.length && (cats.includes("ai") || cats.includes("aideal"))) for (const id of ready.slice(0, 2)) steps.push(["radar", { engines: [id] }]);
    steps.push(["judge", {}], ["cleanup", {}], ["check", {}], ["watch", {}]);
  }
  if (!aiReady) log.push("\u672A\u914D\u7F6E AI\uFF0C\u4F7F\u7528\u5173\u952E\u8BCD\u5224\u5B9A");
  const r = await env.DB.prepare("INSERT INTO runs (trigger, started_at, finished_at, stats, log) VALUES (?, ?, NULL, ?, ?) RETURNING id").bind(trigger, now, JSON.stringify(ZERO_STATS()), log.join("\n")).first();
  const runId = r.id;
  const stmts = steps.map(([kind, payload], i) => env.DB.prepare("INSERT INTO jobs (run_id, seq, kind, payload, status) VALUES (?, ?, ?, ?, 'pending')").bind(runId, i, kind, JSON.stringify(payload)));
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  return { run_id: runId, steps: steps.length };
}
async function runJob(env, job, c, stats, log, runStats) {
  const p = JSON.parse(job.payload || "{}");
  switch (job.kind) {
    case "source": {
      const src = p.src;
      const day = dayOf(Date.now());
      try {
        const items = await fetchSource(src, c.cutoff, env);
        log.push(`\u2713 ${src.name}: ${items.length} \u6761`);
        await ingest(env, c, src, items, stats, log);
        await env.DB.prepare("INSERT INTO src_health (name, day, fetched, added, errors, last_at) VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT(name, day) DO UPDATE SET fetched = fetched + excluded.fetched, added = added + excluded.added, last_at = excluded.last_at").bind(src.name || src.type, day, items.length, stats.new, Date.now()).run();
      } catch (e) {
        stats.errors++;
        log.push(`\u2717 ${src.name}: ${e.message}`);
        await env.DB.prepare("INSERT INTO src_health (name, day, errors, last_err) VALUES (?, ?, 1, ?) ON CONFLICT(name, day) DO UPDATE SET errors = errors + 1, last_err = excluded.last_err").bind(src.name || src.type, day, String(e.message).slice(0, 200)).run().catch(() => {
        });
      }
      return false;
    }
    case "search": {
      const ids = p.engines || [p.engine];
      const results = await Promise.all(ids.map((id) => runBackend(c.s, id, c.maxAgeDays).then((r) => ({ id, r }), (e) => ({ id, e }))));
      for (const { id, r, e } of results) {
        const name = (BACKEND_MAP[id]?.name || id) + " \u641C\u7D22";
        if (e) {
          stats.errors++;
          log.push(`\u2717 ${name}: ${e.message}`);
          continue;
        }
        for (const x of r.errors) log.push(`! ${name} \u90E8\u5206\u67E5\u8BE2\u5931\u8D25\uFF1A${x}`);
        if (r.skipped) {
          log.push(`\u2013 ${name}: ${r.skipped}`);
          continue;
        }
        log.push(`\u2713 ${name}: ${r.items.length} \u6761`);
        await ingest(env, c, { name, isSearch: true, cats: c.s[`${id}_cats`] ? backendCats(c.s, id) : null }, r.items, stats, log);
      }
      return false;
    }
    case "radar": {
      const round = Number(await getMeta(env, "radar_round")) || 0;
      await setMeta(env, "radar_round", round + 1);
      const queries = radarQueries(c.s, round);
      const days = Math.min(c.maxAgeDays, Math.max(1, Number(c.s.aifree_days) || 30));
      const allow = ["ai", "aideal"].filter((k) => c.cats.includes(k));
      const results = await Promise.all((p.engines || []).map((id) => runBackend({ ...c.s, search_queries: queries.join("\n"), search_lang: "any", search_max_queries: String(queries.length), [`${id}_cats`]: allow.join(",") }, id, days).then((r) => ({ id, r }), (e) => ({ id, e }))));
      for (const { id, r, e } of results) {
        const name = "AI \u798F\u5229\u96F7\u8FBE \xB7 " + (BACKEND_MAP[id]?.name || id);
        if (e) {
          stats.errors++;
          log.push(`\u2717 ${name}: ${e.message}`);
          continue;
        }
        for (const x of r.errors) log.push(`! ${name} \u90E8\u5206\u67E5\u8BE2\u5931\u8D25\uFF1A${x}`);
        log.push(`\u2713 ${name}: ${r.items.length} \u6761\uFF08${queries.join(" / ")}\uFF09`);
        for (const it of r.items) it.source = name;
        await ingest(env, c, { name, isSearch: true, radar: true, cats: allow, hint: "aideal" }, r.items, stats, log);
      }
      return false;
    }
    case "judge":
      return judgeStep(env, c, stats, log, Math.max(0, (runStats.judged || 0) - (runStats.auto || 0) - (runStats.cached || 0)), p.cap);
    case "cleanup":
      await cleanupStep(env, c, stats);
      return false;
    case "check":
      return checkStep(env, c, stats, log);
    case "watch":
      return watchStep(env, c, stats, log);
    case "mail": {
      try {
        const r = await sendDigest(env);
        log.push(r.skipped ? `\u2013 \u63A8\u9001\u8DF3\u8FC7\uFF1A${r.skipped}` : `\u2713 \u5DF2\u63A8\u9001 ${r.sent} \u6761\uFF08${r.providers.join(" + ")}\uFF09\u2192 ${r.to.join(", ")}${r.errors.length ? "\n\u2717 " + r.errors.join("\n\u2717 ") : ""}`);
      } catch (e) {
        stats.errors++;
        log.push(`\u2717 \u63A8\u9001\u5931\u8D25\uFF1A${e.message}`);
      }
      return false;
    }
  }
  return false;
}
async function tick(env, maxSteps = 1) {
  const run = await env.DB.prepare("SELECT * FROM runs WHERE finished_at IS NULL ORDER BY id DESC LIMIT 1").first();
  if (!run) return { idle: true };
  const s = await getSettings(env);
  const c = ctxOf(s, run.started_at);
  const runStats = { ...ZERO_STATS(), ...JSON.parse(run.stats || "{}") };
  const log = [];
  let current = null;
  let busy = false;
  for (let n = 0; n < maxSteps; n++) {
    const t = Date.now();
    const stuck = await env.DB.prepare("UPDATE jobs SET status = CASE WHEN tries >= 1 THEN 'done' ELSE 'pending' END, tries = tries + 1 WHERE run_id = ? AND status = 'running' AND claimed_at < ? RETURNING kind, status, payload").bind(run.id, t - 4 * 6e4).all();
    for (const j of stuck.results || []) if (j.status === "done") {
      let nm = "";
      try {
        nm = JSON.parse(j.payload || "{}").src?.name || "";
      } catch {
      }
      log.push(`\u2717 ${STEP_LABEL[j.kind] || j.kind}${nm ? "\uFF1A" + nm : ""} \u4E24\u6B21\u6CA1\u8DD1\u5B8C\uFF08\u53EF\u80FD\u8D85\u51FA CPU \u9650\u5236\uFF09\uFF0C\u5DF2\u8DF3\u8FC7`);
    }
    const job = await env.DB.prepare(
      `UPDATE jobs SET status = 'running', claimed_at = ?1
       WHERE id = (SELECT id FROM jobs WHERE run_id = ?2 AND status = 'pending' ORDER BY seq LIMIT 1)
         AND NOT EXISTS (SELECT 1 FROM jobs WHERE run_id = ?2 AND status = 'running')
       RETURNING *`
    ).bind(t, run.id).first();
    if (!job) {
      busy = !!await env.DB.prepare("SELECT 1 AS x FROM jobs WHERE run_id = ? AND status = 'running' LIMIT 1").bind(run.id).first();
      break;
    }
    const pl = JSON.parse(job.payload || "{}");
    current = STEP_LABEL[job.kind] + (job.kind === "source" ? "\uFF1A" + (pl.src?.name || "") : job.kind === "search" || job.kind === "radar" ? "\uFF1A" + (pl.engines || [pl.engine]).map((id) => BACKEND_MAP[id]?.name || id).join(" + ") : "");
    const stats = ZERO_STATS();
    let again = false;
    try {
      again = await runJob(env, job, c, stats, log, runStats);
    } catch (e) {
      stats.errors++;
      log.push(`\u2717 ${current} \u51FA\u9519\uFF1A${e.message}`);
    }
    await env.DB.prepare("UPDATE jobs SET status = ? WHERE id = ?").bind(again ? "pending" : "done", job.id).run();
    const fresh = await env.DB.prepare("SELECT stats FROM runs WHERE id = ?").bind(run.id).first();
    const merged = { ...ZERO_STATS(), ...JSON.parse(fresh?.stats || "{}") };
    for (const k of Object.keys(stats)) merged[k] = (merged[k] || 0) + stats[k];
    Object.assign(runStats, merged);
    await env.DB.prepare("UPDATE runs SET stats = ? WHERE id = ?").bind(JSON.stringify(merged), run.id).run();
  }
  const left = await env.DB.prepare("SELECT COUNT(*) AS n, (SELECT COUNT(*) FROM jobs WHERE run_id = ?) AS total FROM jobs WHERE run_id = ? AND status != 'done'").bind(run.id, run.id).first();
  const done = !left || left.n === 0;
  const now = Date.now();
  if (done) {
    const fin = await env.DB.prepare("UPDATE runs SET finished_at = ? WHERE id = ? AND finished_at IS NULL").bind(now, run.id).run();
    if (fin.meta?.changes) log.push(`\u5B8C\u6210\uFF0C\u7528\u65F6 ${Math.max(1, Math.round((now - run.started_at) / 1e3))}s`);
  }
  const add = log.join("\n");
  if (add) await env.DB.prepare("UPDATE runs SET log = CASE WHEN log = '' THEN ? ELSE log || char(10) || ? END WHERE id = ?").bind(add, add, run.id).run();
  return { run_id: run.id, done, busy, current, left: left?.n || 0, total: left?.total || 0, stats: runStats, log };
}

// src/sources-sync.js
var FREEBIE_SEEDS_URL = "https://raw.githubusercontent.com/ZiChuanLan/freebie-radar/main/src/server/collectors/index.ts";
var CJK3 = /[\u4e00-\u9fff]/;
var EN_HOSTS = ["reddit.com", "itch.io", "isthereanydeal.com", "indiegamebundles.com", "freesteamkeys.com", "gg.deals", "giveawayoftheday.com", "tickcoupon.com", "sharewareonsale.com", "lowendtalk.com", "lowendspirit.com", "lowendbox.com", "news.ycombinator.com"];
var BLOCKED_HOSTS = ["linux.do", "reddit.com", "deepflood.com", "52pojie.cn", "hostloc.com", "423down.com"];
var NEWS_HOSTS = ["chinanews.com.cn", "wallstreetcn.com", "qbitai.com", "leiphone.com", "tmtpost.com", "ifanr.com", "36kr.com", "huxiu.com", "cctv.com", "thepaper.cn", "sspai.com", "ithome.com", "cnbeta.com.tw"];
var ZH_HOSTS = ["linux.do", "nodeseek.com", "nodeloc.com", "deepflood.com", "vpsgo.com", "vpsxb.net", "keylol.com", "free.com.tw", "v2ex.com", "appinn.com", "appinn.net", "ghxi.com", "yxssp.com", "iplaysoft.com", "vpsjxw.com", "laozuo.org", "veidc.com", "vpser.net", "banwagong.net"];
var CAT_HINT = { vps: "hosting", hosting: "hosting", software: "software", pan: "pan", game: "game", ai: "ai", domain: "domain", cloud: "cloud", dev: "dev", edu: "edu", course: "course", media: "media", design: "design" };
var hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};
var hostIn = (h, list) => list.some((d) => h === d || h.endsWith("." + d));
var reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function sourceKey(x) {
  const t = x.type || "rss";
  if (t === "rss") {
    const tg = x.tags || x.skip_tags ? "#" + [].concat(x.tags || []).join(",") + "!" + [].concat(x.skip_tags || []).join(",") : "";
    try {
      const u = new URL(x.url);
      return "rss:" + u.hostname.replace(/^www\./, "").toLowerCase() + u.pathname.replace(/\/+$/, "") + u.search + tg;
    } catch {
      return "rss:" + x.url + tg;
    }
  }
  if (t === "v2ex") return "v2ex:" + (x.node || "free");
  if (t === "repo") return "repo:" + String(x.repo || "").toLowerCase();
  if (t === "telegram") return "tg:" + String(x.channel || "").toLowerCase();
  if (t === "gamerpower") return "gamerpower:" + (x.kind || "game");
  return t + ":" + String(x.query || "").toLowerCase();
}
function parseFreebieSeeds(ts) {
  const start = ts.indexOf("export const SEEDS");
  if (start < 0) throw new Error("\u6CA1\u627E\u5230 SEEDS");
  const open = ts.indexOf("[", ts.indexOf("=", start));
  let depth = 0, end = -1, q = null;
  for (let i = open; i < ts.length; i++) {
    const ch = ts[i];
    if (q) {
      if (ch === "\\") i++;
      else if (ch === q) q = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      q = ch;
      continue;
    }
    if (ch === "/" && ts[i + 1] === "/") {
      const nl = ts.indexOf("\n", i);
      i = nl < 0 ? ts.length : nl;
      continue;
    }
    if (ch === "[" || ch === "{") depth++;
    else if ((ch === "]" || ch === "}") && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("SEEDS \u6570\u7EC4\u4E0D\u5B8C\u6574");
  const src = ts.slice(open, end + 1);
  const parts = [];
  let last = "{";
  const ID0 = /[A-Za-z_$]/, IDC = /[\w$]/;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== ch) j += src[j] === "\\" ? 2 : 1;
      const body = src.slice(i + 1, j);
      parts.push(ch === '"' ? '"' + body + '"' : JSON.stringify(body.replace(/\\'/g, "'")));
      last = '"';
      i = j;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = (nl < 0 ? src.length : nl) - 1;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2);
      i = (e < 0 ? src.length : e + 2) - 1;
      continue;
    }
    if (ID0.test(ch)) {
      let j = i + 1;
      while (j < src.length && IDC.test(src[j])) j++;
      const word = src.slice(i, j);
      let k = j;
      while (src[k] === " " || src[k] === "	") k++;
      parts.push((last === "{" || last === ",") && src[k] === ":" ? '"' + word + '"' : word);
      last = "a";
      i = j - 1;
      continue;
    }
    parts.push(ch);
    if (ch !== " " && ch !== "\n" && ch !== "\r" && ch !== "	") last = ch;
  }
  let out = parts.join("");
  out = out.replace(/,(\s*[}\]])/g, "$1");
  const seeds = JSON.parse(out);
  return seeds.flatMap(seedToSources).filter(Boolean);
}
function seedToSources(seed) {
  const c = seed.config || {};
  const cat = CAT_HINT[c.fixedCategory] || CAT_HINT[c.categoryHint] || void 0;
  const info = c.kindHint === "info" || [c.categoryHint, c.fixedCategory, ...(c.feeds || []).map((f) => f.categoryHint)].some((h) => h && !CAT_HINT[h]);
  const base = { from: "freebie-radar", upstream_enabled: seed.enabled !== false, ...info ? { info: true } : {} };
  switch (seed.kind) {
    case "rss":
      return (c.feeds || []).filter((f) => f.url).map((f, i, all) => {
        const o = { name: all.length > 1 ? `${seed.name} \xB7 ${f.id}` : seed.name, type: "rss", url: f.url, ...base };
        if (f.titleKeywords?.length) o.include = f.titleKeywords.map(reEscape).join("|");
        if (f.only100Off) o.include = "100%";
        const hint = CAT_HINT[f.categoryHint] || cat;
        if (hint) o.hint = hint;
        return o;
      });
    case "v2ex":
      return [{ name: seed.name, type: "v2ex", node: c.node || "free", ...base }];
    case "telegram":
      return (c.channels || []).map((ch) => ({ name: `${seed.name.replace(/（.*?）/, "")} \xB7 @${ch}`, type: "telegram", channel: ch, ...cat ? { hint: cat } : {}, ...base }));
    case "linuxdo":
      return c.categoryId ? [{ name: seed.name, type: "rss", url: `https://linux.do/c/${c.rssSlug || c.categoryId}/${c.categoryId}.rss`, ...base }] : [];
    case "epic":
      return [{ name: seed.name, type: "epic", category: "game", trusted: true, ...base }];
    case "gamerpower": {
      const kind = /loot/.test(c.query || "") ? "loot" : "game";
      return [{ name: seed.name, type: "gamerpower", kind, category: "game", trusted: true, ...base }];
    }
    case "openrouter":
      return [{ name: seed.name, type: "openrouter_free", category: "ai", trusted: true, ...base }];
    default:
      return [{ unsupported: true, name: seed.name, kind: seed.kind }];
  }
}
function zhOf(x) {
  const h = hostOf(x.url || "");
  if (h && hostIn(h, EN_HOSTS)) return false;
  if (h && hostIn(h, ZH_HOSTS)) return true;
  if (["v2ex", "telegram", "epic", "gamerpower", "openrouter_free"].includes(x.type)) return true;
  return CJK3.test(String(x.name || "").trim().split(/[\s·]/)[0]) || /\.(cn|tw|hk)$/.test(h);
}
async function checkSources(current, urls) {
  const have = new Set(current.map(sourceKey));
  const groups = [{ id: "builtin", label: "\u5185\u7F6E\u63A8\u8350\uFF08\u672C\u7248\u672C\u65B0\u589E\uFF09", list: DEFAULT_SOURCES.map((x) => ({ ...x, from: "builtin", upstream_enabled: x.enabled !== false })) }];
  const errors = [];
  let unsupported = 0;
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "free-resource-radar", Accept: "*/*" }, signal: AbortSignal.timeout(15e3) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const text = await r.text();
      let list;
      if (/^\s*[[{]/.test(text)) {
        const j = JSON.parse(text);
        list = (Array.isArray(j) ? j : j.sources || []).filter((x) => x && (x.url || x.type)).map((x) => ({ ...x, from: url, upstream_enabled: x.enabled !== false }));
      } else {
        list = parseFreebieSeeds(text);
      }
      unsupported += list.filter((x) => x.unsupported).length;
      const label = url === FREEBIE_SEEDS_URL || /freebie-radar/.test(url) ? "freebie-radar" : url.replace(/^https?:\/\//, "").slice(0, 60);
      groups.push({ id: url, label, list: list.filter((x) => !x.unsupported) });
    } catch (e) {
      errors.push(`${url}\uFF1A${e.message}`);
    }
  }
  const seen = new Set(have);
  const out = [];
  let existing = 0;
  for (const g of groups) {
    const fresh = [];
    for (const x of g.list) {
      const k = sourceKey(x);
      if (seen.has(k)) {
        if (have.has(k)) existing++;
        continue;
      }
      seen.add(k);
      const zh = zhOf(x);
      const blocked = hostIn(hostOf(x.url || ""), BLOCKED_HOSTS);
      const info = x.info || hostIn(hostOf(x.url || ""), NEWS_HOSTS) && !x.include;
      const { upstream_enabled, from, info: _i, ...src } = x;
      src.enabled = true;
      const why = !zh ? "\u82F1\u6587" : blocked ? "\u673A\u623F\u5E38\u88AB\u62E6" : info ? "\u8D44\u8BAF\u7C7B" : !upstream_enabled ? "\u4E0A\u6E38\u672A\u542F\u7528" : "";
      fresh.push({ key: k, suggest: !why, why, src });
    }
    if (fresh.length) out.push({ id: g.id, label: g.label, items: fresh });
  }
  return { groups: out, existing, unsupported, errors };
}
var UA2 = { "User-Agent": "Mozilla/5.0 (compatible; free-resource-radar)", Accept: "text/html,application/xml,application/rss+xml,*/*" };
var SKIP_HOSTS = ["zhihu.com", "bilibili.com", "weixin.qq.com", "qq.com", "baidu.com", "csdn.net", "github.com", "gitee.com", "douyin.com", "weibo.com", "xiaohongshu.com", "toutiao.com", "sohu.com", "163.com", "sina.com.cn", "youtube.com", "google.com", "wikipedia.org", "jianshu.com", "juejin.cn", "cnblogs.com", "smzdm.com", "taobao.com", "jd.com", "apple.com", "microsoft.com"];
var decode = (s) => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
async function getHead(url, limit = 2e5) {
  const r = await fetch(url, { headers: UA2, redirect: "follow", signal: AbortSignal.timeout(1e4) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const t = await r.text();
  return { text: t.slice(0, limit), url: r.url || url };
}
function feedInfo(xml) {
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(xml.slice(0, 3e3))) return null;
  const titles = [...xml.matchAll(/<(?:item|entry)[\s>][\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => decode(m[1]));
  const dates = [...xml.matchAll(/<(?:pubDate|updated|published|dc:date)>([^<]+)</gi)].map((m) => Date.parse(m[1])).filter((x) => x > 0);
  const zh = titles.length ? titles.filter((t) => CJK3.test(t)).length / titles.length >= 0.5 : false;
  const name = decode((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(xml) || [])[1]).slice(0, 40);
  return { count: titles.length, latest: dates.length ? Math.max(...dates) : null, zh, name, sample: titles.slice(0, 3) };
}
var ago = (t) => {
  if (!t) return "\u65E0\u65E5\u671F";
  const d = Math.floor((Date.now() - t) / 864e5);
  return d <= 0 ? "\u4ECA\u5929\u66F4\u65B0" : d + " \u5929\u524D\u66F4\u65B0";
};
async function probeOne(raw) {
  const line2 = raw.trim();
  if (/^\{/.test(line2)) {
    const x = JSON.parse(line2);
    return { src: { enabled: true, ...x }, note: "JSON" };
  }
  const tg = /^(?:https?:\/\/)?t\.me\/(?:s\/)?([A-Za-z0-9_]{4,})/.exec(line2) || /^@([A-Za-z0-9_]{4,})$/.exec(line2);
  if (tg) {
    const { text } = await getHead(`https://t.me/s/${tg[1]}`, 3e5);
    const n = (text.match(/tgme_widget_message_text/g) || []).length;
    if (!n) throw new Error("\u9891\u9053\u6CA1\u6709\u516C\u5F00\u6D88\u606F\u9875");
    const title = decode((/<meta property="og:title" content="([^"]+)"/.exec(text) || [])[1]) || tg[1];
    const texts = [...text.matchAll(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
    const dates = [...text.matchAll(/datetime="([^"]+)"/g)].map((m) => Date.parse(m[1])).filter(Boolean);
    return { src: { name: `TG \xB7 ${title}`, type: "telegram", channel: tg[1], enabled: true }, zh: texts.filter((t) => CJK3.test(t)).length >= texts.length / 2, count: n, latest: dates.length ? Math.max(...dates) : null };
  }
  const gh = /^(?:https?:\/\/)?github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?(?:\/.*)?$/i.exec(line2);
  if (gh && !/^(orgs|topics|search|settings|marketplace)\//.test(gh[1])) {
    const commits = await ghCommits(gh[1]);
    if (!commits.length) throw new Error("\u4ED3\u5E93\u6CA1\u6709\u516C\u5F00\u63D0\u4EA4\u8BB0\u5F55");
    const subLike = commits.slice(0, 5).filter((c) => /节点|订阅|node|sub|proxy|v2ray|clash/i.test(c.title)).length >= 3;
    return {
      src: subLike ? { name: gh[1], type: "repo", repo: gh[1], mode: "sub", category: "proxy", trusted: true, subs: [], enabled: true } : { name: `GitHub \xB7 ${gh[1]}`, type: "repo", repo: gh[1], mode: "diff", enabled: true },
      zh: commits.some((c) => CJK3.test(c.title)),
      count: commits.length,
      latest: commits[0].date,
      sample: commits.slice(0, 3).map((c) => c.title.slice(0, 40))
    };
  }
  if (!/^https?:\/\//.test(line2)) throw new Error("\u4E0D\u662F\u7F51\u5740\u3001t.me \u94FE\u63A5\u3001GitHub \u4ED3\u5E93\u6216 @\u9891\u9053");
  const page = await getHead(line2);
  let info = feedInfo(page.text), feed = page.url;
  if (!info) {
    const alts = [...page.text.matchAll(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/gi)].map((m) => (/href=["']([^"']+)["']/.exec(m[0]) || [])[1]).filter(Boolean).filter((h2) => !/comments/.test(h2));
    const origin = new URL(page.url).origin;
    const tries = [...alts.map((h2) => new URL(h2, page.url).href), `${origin}/feed`, `${origin}/rss.xml`, `${origin}/feed.xml`].filter((v, i, a) => a.indexOf(v) === i).slice(0, alts.length ? 2 : 3);
    for (const u of tries) {
      try {
        const f = await getHead(u);
        info = feedInfo(f.text);
        if (info) {
          feed = f.url;
          break;
        }
      } catch {
      }
    }
    if (!info) throw new Error("\u6CA1\u627E\u5230 RSS/Atom \u8BA2\u9605\u5730\u5740");
  }
  const h = hostOf(feed);
  return { src: { name: info.name || h, type: "rss", url: feed, enabled: true }, zh: info.zh, count: info.count, latest: info.latest, sample: info.sample };
}
function toCandidate(p, have) {
  const k = sourceKey(p.src);
  const h = hostOf(p.src.url || "");
  const why = have.has(k) ? "\u5DF2\u6709" : p.zh === false ? "\u82F1\u6587" : hostIn(h, BLOCKED_HOSTS) ? "\u673A\u623F\u5E38\u88AB\u62E6" : p.count === 0 ? "\u6CA1\u6709\u6761\u76EE" : p.latest && Date.now() - p.latest > 180 * 864e5 ? "\u534A\u5E74\u6CA1\u66F4\u65B0" : "";
  const facts = [p.count != null ? p.count + " \u6761" : "", p.latest !== void 0 ? ago(p.latest) : ""].filter(Boolean).join(" \xB7 ");
  return { key: k, suggest: !why, why, facts, sample: (p.sample || []).join(" / ").slice(0, 120), src: p.src };
}
async function probeInputs(current, lines2) {
  const have = new Set(current.map(sourceKey));
  const items = [], errors = [];
  const list = [...new Set(lines2.map((x) => x.trim()).filter(Boolean))].slice(0, 15);
  const res = await Promise.allSettled(list.map(probeOne));
  res.forEach((r, i) => r.status === "fulfilled" ? items.push(toCandidate(r.value, have)) : errors.push(`${list[i].slice(0, 60)}\uFF1A${r.reason?.message || r.reason}`));
  return { groups: items.length ? [{ id: "batch", label: "\u6279\u91CF\u6DFB\u52A0", items }] : [], existing: items.filter((x) => x.why === "\u5DF2\u6709").length, errors };
}
async function discoverSources(current, keyword, searchFn) {
  const have = new Set(current.map(sourceKey));
  const haveHosts = new Set(current.map((x) => hostOf(x.url || "")).filter(Boolean));
  const { results, errors } = await searchFn([`${keyword} RSS \u8BA2\u9605`, `${keyword} \u535A\u5BA2`]);
  const hosts = [];
  for (const r of results) {
    const h = hostOf(r.url);
    if (!h || hosts.some((x) => x.h === h) || haveHosts.has(h) || hostIn(h, SKIP_HOSTS) || hostIn(h, BLOCKED_HOSTS)) continue;
    hosts.push({ h, url: new URL(r.url).origin + "/", title: r.title });
    if (hosts.length >= 8) break;
  }
  const res = await Promise.allSettled(hosts.map((x) => probeOne(x.url)));
  const items = [], miss = [];
  res.forEach((r, i) => r.status === "fulfilled" ? items.push(toCandidate(r.value, have)) : miss.push(hosts[i].h));
  if (miss.length) errors.push(`\u8FD9\u4E9B\u7AD9\u6CA1\u627E\u5230\u8BA2\u9605\u5730\u5740\uFF1A${miss.join("\u3001")}`);
  return { groups: items.length ? [{ id: "discover", label: `\u641C\u7D22\u300C${keyword}\u300D\u53D1\u73B0`, items }] : [], existing: items.filter((x) => x.why === "\u5DF2\u6709").length, errors, searched: hosts.length };
}

// src/snap.js
var HEAD_N = 60;
var PART = 120;
var OLD_N = 200;
var ITEM_COLS = "id, title, url, source, published_at, fetched_at, day, category, name, summary, signup, score, obtain, target, sources, extra, expires_at, up, down, dead";
var ORDER = "ORDER BY published_at IS NULL, published_at DESC, fetched_at DESC, id";
var shapeItems = (rows) => foldItems(rows || []).map((it) => {
  if (it.extra) {
    try {
      it.extra = JSON.parse(it.extra);
    } catch {
      delete it.extra;
    }
  } else delete it.extra;
  if (it.published_at) delete it.fetched_at;
  if (it.summary && it.summary.length > 160) it.summary = it.summary.slice(0, 160) + "\u2026";
  delete it.target;
  for (const k of ["up", "down", "dead", "expires_at", "signup", "score", "obtain", "name", "summary", "srcs"]) if (it[k] == null || it[k] === 0) delete it[k];
  return it;
});
var pack = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
function windowOf(st, now = Date.now()) {
  const cutoff = now - (Number(st.max_age_days) || 180) * 864e5;
  const fresh = now - Math.max(1, Number(st.fresh_days) || 15) * 864e5;
  const live = `status = 'approved' AND (expires_at IS NULL OR expires_at > ${now - 864e5})`;
  return { cutoff, fresh, live };
}
async function ensureSnapTable(env) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS snap (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL)").run();
}
var markDirty = (env) => setMeta(env, "snap_dirty", Date.now()).catch(() => {
});
async function readSnap(env, part) {
  const r = await env.DB.prepare("SELECT s.v AS v, m.value AS ver FROM secrets m LEFT JOIN snap s ON s.k = m.value || ':' || ? WHERE m.key = 'meta:snap_ver'").bind(part).first().catch(() => null);
  if (!r) return null;
  return r.v ? r : { ver: r.ver, v: part === "head" ? null : '{"items":[]}' };
}
async function headMeta(env, st, now) {
  const { cutoff, fresh, live } = windowOf(st, now);
  const [last, oldN, total, wk] = await Promise.all([
    env.DB.prepare("SELECT MAX(finished_at) AS t FROM runs WHERE trigger != 'mail'").first(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM items WHERE ${live} AND published_at >= ? AND published_at < ?`).bind(cutoff, fresh).first(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM items WHERE ${live} AND (published_at IS NULL OR published_at >= ?)`).bind(fresh).first(),
    // 本周精选只看近 7 天、分最高的一批
    env.DB.prepare(`SELECT id, title, name, category, score, up, down, obtain, expires_at, dead, extra, published_at, fetched_at, sources FROM items WHERE ${live} AND COALESCE(published_at, fetched_at) >= ? ORDER BY score DESC LIMIT 150`).bind(now - 7 * 864e5).all()
  ]);
  const wl = (wk.results || []).map((it) => {
    if (it.extra) {
      try {
        it.extra = JSON.parse(it.extra);
      } catch {
        it.extra = null;
      }
    }
    try {
      it.srcs = it.sources ? JSON.parse(it.sources) : [];
    } catch {
      it.srcs = [];
    }
    return it;
  });
  return {
    today: dayOf(now),
    retention_days: Number(st.retention_days) || 15,
    run_hour: Number(st.run_hour) || 0,
    every: Math.min(24, Math.max(1, Number(st.crawl_every_hours) || 24)),
    last_run: last?.t || null,
    fresh_days: Math.max(1, Number(st.fresh_days) || 15),
    old_count: oldN?.n || 0,
    total: total?.n || 0,
    groups: GROUPS,
    categories: enabledCats(st).map((k) => ({ key: k, label: CAT_MAP[k].label, color: CAT_MAP[k].color, group: CAT_MAP[k].group, info: !!CAT_MAP[k].info })),
    weekly: weeklyPicks(wl, now).map((x) => x.id),
    perks: perksOf(st),
    checkin: checkinOf(st),
    vote: true
  };
}
async function liveHead(env) {
  const st = await getBasicSettings(env);
  const now = Date.now();
  const { fresh, live } = windowOf(st, now);
  const [meta, rows] = await Promise.all([
    headMeta(env, st, now),
    env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE ${live} AND (published_at IS NULL OR published_at >= ?) ${ORDER} LIMIT ${HEAD_N}`).bind(fresh).all()
  ]);
  const items = shapeItems(rows.results);
  return pack({ ...meta, ver: "live", parts: meta.total > HEAD_N ? -1 : 0, items });
}
async function livePart(env, i) {
  const st = await getBasicSettings(env);
  const { fresh, live } = windowOf(st);
  const rows = await env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE ${live} AND (published_at IS NULL OR published_at >= ?) ${ORDER} LIMIT ${PART} OFFSET ?`).bind(fresh, HEAD_N + (i - 1) * PART).all();
  const items = shapeItems(rows.results);
  return pack({ items, more: items.length >= PART });
}
async function liveOld(env) {
  const st = await getBasicSettings(env);
  const { cutoff, fresh, live } = windowOf(st);
  const rows = await env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE ${live} AND published_at >= ? AND published_at < ? ORDER BY published_at DESC LIMIT ${OLD_N}`).bind(cutoff, fresh).all();
  return pack({ items: shapeItems(rows.results) });
}
async function snapStep(env, force = false) {
  await ensureSnapTable(env);
  let b = null;
  try {
    b = JSON.parse(await getMeta(env, "snap_build") || "null");
  } catch {
  }
  const now = Date.now();
  if (b && now - b.at > 30 * 6e4) b = null;
  if (!b) {
    const dirty = Number(await getMeta(env, "snap_dirty")) || 0;
    const built = Number(await getMeta(env, "snap_at")) || 0;
    const ver = await getMeta(env, "snap_ver");
    if (!force && ver && dirty <= built && now - built < 6 * 36e5) return null;
    b = { ver: now.toString(36), i: 0, n: 0, at: now };
  }
  const st = await getBasicSettings(env);
  const { cutoff, fresh, live } = windowOf(st, b.at);
  const key = (p) => `${b.ver}:${p}`;
  const put = (p, v) => env.DB.prepare("INSERT INTO snap (k, v, at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, at = excluded.at").bind(key(p), v, now).run();
  if (b.i === 0) {
    const [meta, rows] = await Promise.all([
      headMeta(env, st, b.at),
      env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE ${live} AND (published_at IS NULL OR published_at >= ?) ${ORDER} LIMIT ${HEAD_N}`).bind(fresh).all()
    ]);
    b.n = Math.max(0, Math.ceil((meta.total - HEAD_N) / PART));
    b.meta = true;
    await put("head", pack({ ...meta, ver: b.ver, parts: b.n, items: shapeItems(rows.results) }));
    b.i = 1;
  } else if (b.i <= b.n) {
    const rows = await env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE ${live} AND (published_at IS NULL OR published_at >= ?) ${ORDER} LIMIT ${PART} OFFSET ?`).bind(fresh, HEAD_N + (b.i - 1) * PART).all();
    await put("part:" + b.i, pack({ items: shapeItems(rows.results) }));
    b.i++;
  } else {
    const rows = await env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE ${live} AND published_at >= ? AND published_at < ? ORDER BY published_at DESC LIMIT ${OLD_N}`).bind(cutoff, fresh).all();
    await put("old", pack({ items: shapeItems(rows.results) }));
    await env.DB.batch([
      env.DB.prepare("INSERT INTO secrets (key, value) VALUES ('meta:snap_ver', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(b.ver),
      env.DB.prepare("INSERT INTO secrets (key, value) VALUES ('meta:snap_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(b.at)),
      env.DB.prepare("DELETE FROM secrets WHERE key = 'meta:snap_build'"),
      env.DB.prepare("DELETE FROM snap WHERE k NOT LIKE ?").bind(b.ver + ":%")
    ]);
    return { building: false, done: true, step: b.n + 2, total: b.n + 2 };
  }
  await setMeta(env, "snap_build", JSON.stringify({ ver: b.ver, i: b.i, n: b.n, at: b.at }));
  return { building: true, done: false, step: b.i, total: b.n + 2 };
}

// src/admin.html
var admin_default = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>\u7BA1\u7406 \xB7 \u514D\u8D39\u8D44\u6E90\u96F7\u8FBE</title>
<meta name="theme-color" content="#f7f7fb" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%234f46e5'/><circle cx='16' cy='16' r='9' fill='none' stroke='%23fff' stroke-width='2' opacity='.5'/><circle cx='16' cy='16' r='4' fill='%23fff'/></svg>" />
<style>
  :root {
    --bg:#f7f7fb; --rail:#f2f2f8; --surface:#fff; --hover:#f6f6fb; --muted:#f1f1f7; --line:#e7e7ef; --line-2:#d6d7e2;
    --ink:#14151c; --ink-2:#3a3d4a; --ink-3:#5f6372; --ink-4:#8a8e9c;
    --brand:#14151c; --accent:#4f46e5; --accent-2:#4338ca; --accent-bg:#eef0ff; --accent-line:#c7cbfb;
    --deal:#047857; --deal-bg:#e8f8f0; --cond:#9a5b0b; --cond-bg:#fdf3e1; --alert:#dc2626; --alert-bg:#fef2f2; --warn:#b45309; --warn-bg:#fff7e6;
    --shadow:0 1px 2px rgba(20,21,28,.04), 0 6px 20px rgba(20,21,28,.06);
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html, body { margin:0; }
  body { font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif; color:var(--ink); background:var(--bg); -webkit-font-smoothing:antialiased; }
  ::selection { background:var(--accent-bg); }
  a { color:var(--accent); text-decoration:none; }
  a:hover { text-decoration:underline; }
  code { font:12px var(--mono); background:var(--muted); padding:1px 6px; border-radius:5px; }
  .app { display:grid; grid-template-columns:244px minmax(0,1fr); min-height:100vh; }

  /* ---------- \u4FA7\u680F ---------- */
  .rail { background:var(--rail); border-right:1px solid var(--line); padding:20px 14px; position:sticky; top:0; height:100vh; overflow:auto; display:flex; flex-direction:column; }
  .brand { display:flex; align-items:center; gap:11px; padding:0 6px 20px; color:var(--ink); }
  .brand:hover { text-decoration:none; }
  .brand:hover b { color:var(--accent); }
  .logo { width:32px; height:32px; border-radius:10px; background:linear-gradient(135deg,#6366f1,#3730a3); display:grid; place-items:center; flex:none; box-shadow:0 4px 12px rgba(79,70,229,.25); }
  .logo i { width:9px; height:9px; border-radius:50%; background:#fff; box-shadow:0 0 0 5px rgba(255,255,255,.25); }
  .brand b { display:block; font-size:14.5px; font-weight:700; transition:color .12s; }
  .brand small { display:block; font-size:12px; color:var(--ink-4); }
  .nav-title { font-size:12px; font-weight:600; color:var(--ink-4); padding:14px 10px 6px; }
  .nav a { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:9px; color:var(--ink-2); font-size:13.5px; transition:background-color .12s; }
  .nav a svg { flex:none; color:var(--ink-4); }
  .nav a .lb { flex:1; }
  .nav a:hover { background:color-mix(in srgb, var(--ink) 5%, transparent); text-decoration:none; }
  .nav a.on { background:var(--surface); color:var(--ink); font-weight:600; box-shadow:var(--shadow); }
  .nav a.on svg { color:var(--accent); }
  .nav .n { font:600 11px/18px var(--mono); color:#fff; background:var(--accent); border-radius:999px; padding:0 7px; font-variant-numeric:tabular-nums; }
  .nav .n:empty { display:none; }
  .rail .foot { margin-top:auto; padding-top:16px; }

  /* ---------- \u9876\u680F ---------- */
  .main { min-width:0; }
  .top { position:sticky; top:0; z-index:10; background:color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter:saturate(1.6) blur(14px); -webkit-backdrop-filter:saturate(1.6) blur(14px); border-bottom:1px solid var(--line); padding:12px 32px; display:flex; align-items:center; gap:10px; min-height:60px; }
  .top h1 { font-size:18px; font-weight:700; margin:0; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .menu { display:none; }
  .page { padding:24px 32px 120px; max-width:1000px; }
  .panel { display:none; animation:in .18s ease; }
  .panel.on { display:block; }
  @keyframes in { from { opacity:0; transform:translateY(4px); } }
  .desc { color:var(--ink-3); margin:-6px 0 18px; font-size:13px; }

  .section { background:var(--surface); border:1px solid var(--line); border-radius:14px; margin-bottom:16px; }
  .section > header { display:flex; align-items:center; gap:10px; padding:14px 18px; border-bottom:1px solid var(--line); }
  .section > header h2 { font-size:14.5px; font-weight:650; margin:0; flex:1; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .section .body { padding:16px 18px; display:grid; gap:16px; }
  .grid2 { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px 18px; }
  .grid3 { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px 18px; }
  label.f { display:block; font-size:12.5px; color:var(--ink-3); margin-bottom:5px; font-weight:500; }
  input[type=text], input[type=password], input[type=number], select, textarea {
    width:100%; height:38px; padding:0 12px; border:1px solid var(--line); border-radius:9px; font:inherit; font-size:13.5px; color:var(--ink); background:var(--surface); outline:none; transition:border-color .12s, box-shadow .12s, background-color .12s; }
  textarea { height:auto; min-height:120px; padding:9px 12px; font:12.5px/1.6 var(--mono); resize:vertical; }
  input:focus, select:focus, textarea:focus { border-color:var(--accent-line); box-shadow:0 0 0 4px var(--accent-bg); }
  .changed input:not([type=checkbox]), .changed select, .changed textarea, input.changed, select.changed, textarea.changed { border-color:#f4c46a; background:var(--warn-bg); }
  .sw.changed::after, .chk.changed::after { content:"\u672A\u4FDD\u5B58"; font-size:11px; color:var(--warn); background:var(--warn-bg); border-radius:999px; padding:0 7px; }
  [data-csv].changed { outline:2px dashed #f4c46a; outline-offset:5px; border-radius:12px; }
  .srcbar { display:flex; gap:8px; margin-bottom:10px; }
  .srcbar input { flex:1; } .srcbar select { width:130px; }
  .srclist { border:1px solid var(--line); border-radius:10px; overflow:hidden; max-height:560px; overflow-y:auto; }
  .srow { display:grid; grid-template-columns:auto minmax(0,1fr) auto auto; gap:12px; align-items:center; padding:9px 12px; border-top:1px solid var(--line); background:var(--surface); }
  .srow:first-child { border-top:none; }
  .srow.off .snm { color:var(--ink-4); }
  .snm { font-weight:600; font-size:13.5px; display:flex; gap:6px; align-items:center; flex-wrap:wrap; min-width:0; }
  .snm small { font-weight:400; color:var(--ink-4); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
  .scats { display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end; cursor:pointer; border:1px dashed transparent; border-radius:8px; padding:3px 6px; transition:.12s; }
  .scats:hover { border-color:var(--line-2); background:var(--hover); }
  .scats .tag.c { background:color-mix(in srgb, var(--cc) 14%, #fff); color:color-mix(in srgb, var(--cc) 80%, #000); }
  .sdel { border:none; background:transparent; color:var(--ink-4); cursor:pointer; width:26px; height:26px; border-radius:7px; font-size:16px; }
  .sdel:hover { background:var(--alert-bg); color:var(--alert); }
  .sedit { grid-column:1 / -1; background:var(--hover); border-radius:9px; padding:12px; display:grid; gap:10px; }
  .sedit .row2 { display:grid; grid-template-columns:200px 1fr; gap:10px; }
  .cpills { display:flex; gap:6px; flex-wrap:wrap; }
  .cpills button { border:1px solid var(--line); background:var(--surface); border-radius:999px; padding:3px 10px; font:inherit; font-size:12.5px; color:var(--ink-3); cursor:pointer; display:inline-flex; gap:5px; align-items:center; transition:.12s; }
  .cpills button i { width:8px; height:8px; border-radius:50%; background:var(--cc); opacity:.35; }
  .cpills button.on { border-color:var(--cc); color:var(--ink); font-weight:600; background:color-mix(in srgb, var(--cc) 10%, #fff); }
  .cpills button.on i { opacity:1; }
  .cpills button.dis { opacity:.45; }
  .cpills .all { font-weight:600; }
  .be .ln .becats { color:var(--ink-3); cursor:pointer; }
  .be .ln .becats b { color:var(--accent-2); font-weight:600; }
  .be .bce { grid-column:1 / -1; margin-top:-2px; }
  .modal { position:fixed; inset:0; background:rgba(20,21,28,.38); display:none; align-items:center; justify-content:center; z-index:80; padding:20px; }
  .modal.on { display:flex; animation:fade .15s; }
  .mbox { background:var(--surface); border-radius:14px; width:min(760px,100%); max-height:86vh; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.2); }
  .mbox header, .mbox footer { display:flex; gap:8px; align-items:center; padding:14px 18px; border-bottom:1px solid var(--line); }
  .mbox footer { border-top:1px solid var(--line); border-bottom:none; }
  .mbox .x { border:none; background:transparent; font-size:20px; cursor:pointer; color:var(--ink-3); width:30px; height:30px; border-radius:8px; }
  .mbody { overflow:auto; padding:6px 18px 14px; }
  .mbody h4 { margin:14px 0 6px; font-size:12.5px; color:var(--ink-3); font-weight:600; }
  .sitem { display:flex; gap:10px; align-items:center; padding:7px 4px; border-top:1px solid var(--line); cursor:pointer; }
  .sitem input { width:16px; height:16px; accent-color:var(--accent); flex:none; }
  .sitem .snm small { display:block; }
  .sitem .snm .smp { display:block; color:var(--ink-3); font-size:11.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:560px; }
  .mtop { padding:12px 18px 4px; display:flex; flex-direction:column; gap:8px; }
  .mtop:empty { display:none; }
  .mtop textarea { min-height:110px; font-family:var(--mono, monospace); font-size:12.5px; }
  .mtop .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .mtop .row input { flex:1; min-width:180px; }
  .mtop .qk { border:1px solid var(--line); background:#fff; border-radius:999px; padding:3px 10px; font-size:12px; cursor:pointer; color:var(--ink-2); }
  .mtop .qk:hover { border-color:var(--accent); color:var(--accent); }
  .srcnew { animation: srcflash 2.4s ease-out; }
  @keyframes srcflash { from { background:#eef2ff; } to { background:transparent; } }
  .sitem .tag.why { background:var(--warn-bg); color:var(--warn); }
  .sp { flex:1; }
  @keyframes fade { from { opacity:0 } }
  @media (max-width: 760px) { .srow { grid-template-columns:auto minmax(0,1fr) auto; } .srow .scats { grid-column:2 / -1; justify-content:flex-start; } .sedit .row2 { grid-template-columns:1fr; } }
  .rcpt { display:flex; flex-wrap:wrap; gap:6px; align-items:center; min-height:38px; padding:4px 6px; border:1px solid var(--line); border-radius:9px; background:var(--surface); cursor:text; transition:border-color .12s, box-shadow .12s; }
  .rcpt:focus-within { border-color:var(--accent-line); box-shadow:0 0 0 4px var(--accent-bg); }
  .rcpt.changed { border-color:#f4c46a; background:var(--warn-bg); }
  .rcpt .em { display:inline-flex; align-items:center; gap:4px; background:var(--accent-bg); color:var(--accent-2); border-radius:7px; padding:2px 4px 2px 9px; font-size:13px; }
  .rcpt .em.bad { background:var(--alert-bg); color:var(--alert); }
  .rcpt .em button { border:none; background:transparent; color:inherit; cursor:pointer; width:20px; height:20px; border-radius:5px; font-size:14px; line-height:1; opacity:.6; }
  .rcpt .em button:hover { opacity:1; background:color-mix(in srgb, currentColor 12%, transparent); }
  .rcpt input { flex:1; min-width:150px; border:none !important; box-shadow:none !important; height:28px; padding:0 4px; background:transparent !important; }
  .pills { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
  .pills button { border:1px solid var(--line); background:var(--surface); border-radius:999px; padding:3px 11px; font:inherit; font-size:12.5px; color:var(--ink-3); cursor:pointer; transition:.12s; }
  .pills button:active { transform:scale(.96); }
  .pills button.on { background:var(--accent-bg); border-color:var(--accent-line); color:var(--accent-2); font-weight:600; }
  .sched { font-size:12.5px; color:var(--ink-3); margin-top:6px; }
  .sched b { color:var(--accent-2); font-weight:600; }
  .hint { font-size:12.5px; color:var(--ink-4); line-height:1.6; }
  .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .row > .grow { flex:1; min-width:180px; }
  .btn { height:36px; padding:0 14px; border-radius:9px; border:1px solid var(--line); background:var(--surface); color:var(--ink-2); font:inherit; font-size:13.5px; font-weight:500; cursor:pointer; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center; gap:6px; transition:transform .08s, background-color .12s, border-color .12s, box-shadow .12s; }
  .btn:hover { background:var(--hover); border-color:var(--line-2); }
  .btn:active { transform:scale(.97); }
  .btn.pri { background:var(--brand); border-color:var(--brand); color:#fff; }
  .btn.pri:hover { background:#2b2e3a; }
  .btn.acc { background:var(--accent); border-color:var(--accent); color:#fff; }
  .btn.danger { color:var(--alert); }
  .btn.sm { height:30px; padding:0 10px; font-size:12.5px; border-radius:8px; }
  .btn:disabled { opacity:.7; cursor:progress; }
  .btn.loading::before { content:""; width:12px; height:12px; border-radius:50%; border:2px solid currentColor; border-right-color:transparent; animation:spin .7s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .btn .dot { width:7px; height:7px; border-radius:50%; background:#f59e0b; display:none; }
  body.dirty .btn.save .dot { display:inline-block; }

  /* \u5F00\u5173 */
  .sw { display:inline-flex; align-items:center; gap:9px; cursor:pointer; font-size:13.5px; color:var(--ink-2); user-select:none; }
  .sw input { appearance:none; -webkit-appearance:none; width:36px; height:21px; border-radius:999px; background:var(--line-2); position:relative; cursor:pointer; transition:.18s; margin:0; flex:none; }
  .sw input::after { content:""; position:absolute; top:2.5px; left:2.5px; width:16px; height:16px; border-radius:50%; background:#fff; transition:.18s; box-shadow:0 1px 3px rgba(0,0,0,.2); }
  .sw input:checked { background:var(--accent); }
  .sw input:checked::after { left:17.5px; }
  .tag { font:600 11px/19px inherit; font-family:inherit; padding:0 8px; border-radius:999px; background:var(--muted); color:var(--ink-3); white-space:nowrap; }
  .tag.free { background:var(--deal-bg); color:var(--deal); }
  .tag.zh { background:var(--accent-bg); color:var(--accent-2); }
  .tag.on { background:var(--deal-bg); color:var(--deal); }
  .tag.off { background:var(--muted); color:var(--ink-4); }
  .tag.bad { background:var(--alert-bg); color:var(--alert); }
  .tag.warn { background:var(--warn-bg); color:var(--warn); }
  .shealth { font-size:11.5px; color:var(--ink-4); white-space:nowrap; }
  .shealth.bad { color:var(--alert); }
  .pushrow { display:grid; grid-template-columns:150px minmax(0,1fr) auto; gap:10px; align-items:center; padding:10px 0; border-top:1px solid var(--line); }
  .pushrow:first-child { border-top:none; padding-top:0; }
  .pushrow .nm { font-weight:600; font-size:13.5px; display:flex; flex-direction:column; gap:4px; }
  .pushrow .in { display:grid; gap:6px; }
  @media (max-width:760px) { .pushrow { grid-template-columns:1fr; } }
  .chk { display:inline-flex; align-items:center; gap:7px; margin:4px 16px 4px 0; font-size:13.5px; color:var(--ink-2); cursor:pointer; }
  .chk input { width:16px; height:16px; accent-color:var(--accent); }
  .callout { background:var(--accent-bg); border:1px solid var(--accent-line); color:var(--accent-2); border-radius:10px; padding:10px 14px; font-size:13px; line-height:1.65; }

  /* \u5206\u7C7B\u5361\u7247 */
  .cats { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:10px; }
  .cat { position:relative; display:flex; gap:10px; align-items:flex-start; border:1px solid var(--line); border-radius:11px; padding:11px 12px; cursor:pointer; user-select:none; transition:border-color .12s, background-color .12s, transform .08s; }
  .cat:hover { border-color:var(--line-2); background:var(--hover); }
  .cat:active { transform:scale(.98); }
  .cat input { position:absolute; opacity:0; pointer-events:none; }
  .cat .ic { width:10px; height:10px; border-radius:50%; flex:none; margin-top:6px; }
  .cat .tx { flex:1; min-width:0; padding-right:20px; }
  .cat b { display:block; font-size:13.5px; font-weight:600; }
  .cat small { display:block; color:var(--ink-4); font-size:11.5px; line-height:1.4; margin-top:2px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
  .cat .ck { position:absolute; right:10px; top:11px; width:18px; height:18px; border-radius:6px; border:1.5px solid var(--line-2); display:grid; place-items:center; font-size:11px; color:transparent; transition:.12s; }
  .cat:has(input:checked) { border-color:var(--accent-line); background:var(--accent-bg); }
  .cat:has(input:checked) .ck { background:var(--accent); border-color:var(--accent); color:#fff; }
  .cgrps { display:flex; flex-direction:column; gap:14px; }
  .cgh { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
  .cgh b { font-size:13.5px; }
  .cgh .btn { margin-left:auto; }
  .cgrp.off .cats { opacity:.7; }
  .cats.mini { grid-template-columns:repeat(auto-fill,minmax(132px,1fr)); }
  .cats.mini .cat { padding:8px 10px; }
  .cats.mini .cat .ic { margin-top:5px; }
  .cats.mini small { display:none; }

  /* \u641C\u7D22\u540E\u7AEF\uFF1A\u7D27\u51D1\u884C */
  .be { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) auto; gap:10px 16px; align-items:center; padding:14px 18px; border-top:1px solid var(--line); }
  .be:first-child { border-top:none; }
  .be .nm { font-weight:650; display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
  .be .q { font-size:12.5px; color:var(--ink-3); margin-top:3px; }
  .be .ops { display:flex; gap:8px; align-items:center; justify-content:flex-end; }
  .be .ln { grid-column:1 / -1; display:flex; gap:14px; font-size:12.5px; margin-top:-4px; }
  .be pre { grid-column:1 / -1; margin:0; }
  .be.off .nm, .be.off .q { opacity:.55; }

  /* \u5217\u8868 */
  .tabs { display:flex; gap:6px; margin-bottom:14px; flex-wrap:wrap; align-items:center; }
  .tabs button { background:var(--surface); border:1px solid var(--line); padding:6px 14px; font:inherit; font-size:13px; color:var(--ink-3); cursor:pointer; border-radius:999px; transition:.12s; }
  .tabs button:active { transform:scale(.97); }
  .tabs button.on { color:#fff; background:var(--ink); border-color:var(--ink); font-weight:600; }
  .tabs .n { font:600 11px var(--mono); margin-left:5px; opacity:.7; }
  .list { background:var(--surface); border:1px solid var(--line); border-radius:14px; overflow:hidden; }
  .item { display:grid; grid-template-columns:44px minmax(0,1fr) auto; gap:12px; padding:14px 16px; border-top:1px solid var(--line); align-items:start; transition:background-color .12s, opacity .2s; }
  .item:first-child { border-top:none; }
  .item:hover { background:var(--hover); }
  .item.gone { opacity:.3; pointer-events:none; }
  .score { font:700 13px/22px var(--mono); color:var(--ink-4); text-align:center; background:var(--muted); border-radius:7px; font-variant-numeric:tabular-nums; }
  .score.hi { color:var(--deal); background:var(--deal-bg); }
  .t { font-size:14.5px; font-weight:600; color:var(--ink); line-height:1.4; word-break:break-word; }
  .t:hover { color:var(--accent); text-decoration:none; }
  .ob { font-size:11px; font-weight:600; border-radius:999px; padding:1px 8px; margin-left:6px; vertical-align:1px; }
  .ob.free { color:var(--deal); background:var(--deal-bg); }
  .ob.cond { color:var(--cond); background:var(--cond-bg); }
  .sum { color:var(--ink-3); margin-top:3px; font-size:13.5px; }
  .meta { color:var(--ink-4); font-size:12px; margin-top:4px; }
  .meta i { font-style:normal; margin:0 6px; color:var(--line-2); }
  .acts { display:flex; gap:6px; opacity:.4; transition:.12s; }
  .item:hover .acts { opacity:1; }
  .empty { color:var(--ink-4); padding:56px 0; text-align:center; }
  .runbox { background:var(--surface); border:1px solid var(--accent-line); border-radius:14px; margin-bottom:16px; overflow:hidden; display:none; }
  .runbox header { display:flex; align-items:center; gap:10px; padding:11px 16px; background:var(--accent-bg); color:var(--accent-2); font-weight:600; font-size:13.5px; }
  .runbox header span { flex:1; }
  .runbox .prog { height:3px; background:var(--accent-line); }
  .runbox .prog i { display:block; height:100%; width:0; background:var(--accent); transition:width .3s; }
  .runbox pre { margin:0; border-radius:0; max-height:320px; overflow:auto; }
  details.run { background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:12px 16px; margin-bottom:8px; }
  details.run summary { cursor:pointer; color:var(--ink-2); }
  pre { background:var(--muted); border-radius:9px; padding:11px 14px; font:12px/1.6 var(--mono); white-space:pre-wrap; word-break:break-all; margin:10px 0 0; color:var(--ink-2); }

  /* \u672A\u4FDD\u5B58\u63D0\u9192\u6761 */
  .savebar { position:fixed; left:50%; bottom:calc(20px + env(safe-area-inset-bottom)); transform:translate(-50%,140%); z-index:25; display:flex; align-items:center; gap:10px; background:var(--ink); color:#fff; padding:8px 8px 8px 18px; border-radius:14px; box-shadow:0 12px 36px rgba(20,21,28,.28); transition:transform .25s cubic-bezier(.2,.8,.2,1); max-width:calc(100vw - 24px); font-size:13.5px; }
  body.dirty .savebar { transform:translate(-50%,0); }
  .savebar .txt { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .savebar .txt::before { content:""; display:inline-block; width:8px; height:8px; border-radius:50%; background:#f59e0b; margin-right:9px; vertical-align:1px; }
  .savebar .btn { height:34px; border-color:rgba(255,255,255,.2); background:transparent; color:#fff; }
  .savebar .btn.acc { background:#fff; color:var(--ink); border-color:#fff; }

  #toast { position:fixed; left:50%; top:16px; transform:translate(-50%,-12px); background:var(--ink); color:#fff; padding:10px 18px; border-radius:11px; box-shadow:0 12px 32px rgba(20,21,28,.22); opacity:0; pointer-events:none; transition:opacity .18s, transform .18s; max-width:min(560px,92vw); z-index:40; font-size:13.5px; }
  #toast.on { opacity:1; transform:translate(-50%,0); }
  #toast.ok::before { content:"\u2713  "; color:#34d399; font-weight:700; }
  #toast.err { background:var(--alert); }
  #gate { position:fixed; inset:0; background:radial-gradient(1200px 600px at 50% -10%, var(--accent-bg), var(--bg)); display:none; align-items:center; justify-content:center; z-index:30; padding:16px; }
  #gate .box { width:min(380px,100%); background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:28px; box-shadow:0 20px 48px rgba(20,21,28,.1); }
  #gate .logo { margin-bottom:16px; width:40px; height:40px; }
  #gate h3 { margin:0 0 4px; font-size:18px; }
  .scrim { display:none; }

  @media (max-width:1023px) { .grid3 { grid-template-columns:repeat(2,minmax(0,1fr)); } }
  @media (max-width:760px) {
    .app { grid-template-columns:1fr; }
    .rail { position:fixed; left:0; top:0; bottom:0; width:min(280px,84vw); z-index:35; transform:translateX(-105%); transition:transform .22s cubic-bezier(.2,.8,.2,1); box-shadow:10px 0 40px rgba(0,0,0,.18); padding-top:calc(20px + env(safe-area-inset-top)); }
    body.drawer .rail { transform:none; }
    .scrim { display:block; position:fixed; inset:0; background:rgba(10,10,20,.4); z-index:34; opacity:0; pointer-events:none; transition:opacity .2s; }
    body.drawer .scrim { opacity:1; pointer-events:auto; }
    .menu { display:grid; place-items:center; width:38px; height:38px; border-radius:10px; border:1px solid var(--line); background:var(--surface); color:var(--ink-2); flex:none; }
    .top { padding:10px 14px; gap:8px; }
    .top h1 { font-size:16.5px; }
    .top .btn { height:34px; padding:0 11px; font-size:13px; }
    .top .btn .lbl-long { display:none; }
    .page { padding:16px 12px 130px; }
    .section > header { padding:12px 14px; }
    .section .body { padding:14px; }
    .grid2, .grid3 { grid-template-columns:1fr; }
    .be { grid-template-columns:1fr; padding:14px; }
    .be .ops { justify-content:flex-start; }
    .item { grid-template-columns:38px minmax(0,1fr); padding:13px 12px; }
    .acts { grid-column:2; opacity:1; flex-wrap:wrap; }
    .savebar { left:12px; right:12px; transform:translateY(160%); justify-content:space-between; }
    body.dirty .savebar { transform:none; }
  }
</style>
</head>
<body>
<div id="gate"><div class="box">
  <span class="logo"><i></i></span>
  <div id="loginBox">
    <h3>\u7BA1\u7406\u540E\u53F0</h3>
    <div class="hint" style="margin-bottom:16px">\u8F93\u5165\u7BA1\u7406\u5458\u5BC6\u7801</div>
    <input type="password" id="tokenInput" placeholder="\u5BC6\u7801" onkeydown="if(event.key==='Enter')login()" />
    <div class="row" style="margin-top:16px"><button class="btn pri" style="flex:1" onclick="login()">\u8FDB\u5165</button><a href="/" class="btn">\u8FD4\u56DE\u8D44\u6E90\u9875</a></div>
  </div>
  <div id="setupBox" style="display:none">
    <h3>\u8BBE\u7F6E\u7BA1\u7406\u5458\u5BC6\u7801</h3>
    <div class="hint" style="margin-bottom:16px">\u9996\u6B21\u4F7F\u7528\uFF0C\u8BF7\u8BBE\u7F6E\u540E\u53F0\u5BC6\u7801\uFF08\u81F3\u5C11 8 \u4F4D\uFF09\u3002\u8BBE\u7F6E\u540E\u53EA\u80FD\u7528\u8FD9\u4E2A\u5BC6\u7801\u767B\u5F55\u3002</div>
    <input type="password" id="pw1" placeholder="\u5BC6\u7801" style="margin-bottom:8px" />
    <input type="password" id="pw2" placeholder="\u518D\u8F93\u5165\u4E00\u6B21" onkeydown="if(event.key==='Enter')setup()" />
    <div class="row" style="margin-top:16px"><button class="btn pri" style="flex:1" onclick="setup()">\u5B8C\u6210\u8BBE\u7F6E</button></div>
  </div>
</div></div>

<div class="scrim" onclick="drawer(false)"></div>
<div class="app">
  <aside class="rail">
    <a class="brand" href="/" title="\u8FD4\u56DE\u8D44\u6E90\u9875"><span class="logo"><i></i></span><span><b>\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE</b><small>\u7BA1\u7406\u540E\u53F0 \xB7 \u70B9\u6B64\u56DE\u9996\u9875</small></span></a>
    <nav class="nav" id="nav">
      <a href="#items" data-p="items"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/></svg><span class="lb">\u8D44\u6E90\u5BA1\u6838</span><span class="n" id="navPending"></span></a>
      <a href="#collect" data-p="collect"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/></svg><span class="lb">\u91C7\u96C6\u4E0E\u5206\u7C7B</span></a>
      <a href="#engine" data-p="engine"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18 9l-4.1 1.4L12 15l-1.9-4.6L6 9l4.1-1.4z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg><span class="lb">AI \u4E0E\u641C\u7D22</span></a>
      <a href="#push" data-p="push"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg><span class="lb">\u63A8\u9001</span></a>
      <a href="#rules" data-p="rules"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h10M4 18h6"/></svg><span class="lb">\u9AD8\u7EA7\u89C4\u5219</span></a>
      <a href="#runs" data-p="runs"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span class="lb">\u8FD0\u884C\u8BB0\u5F55</span></a>
      <a href="#account" data-p="account"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span class="lb">\u8D26\u53F7\u4E0E\u5B89\u5168</span></a>
    </nav>
    <nav class="nav foot">
      <a href="/feed.xml" target="_blank"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg><span class="lb">RSS \u8BA2\u9605</span></a>
      <a href="javascript:logout()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg><span class="lb">\u9000\u51FA\u767B\u5F55</span></a>
    </nav>
  </aside>

  <main class="main">
    <div class="top">
      <button class="menu" onclick="drawer(true)" aria-label="\u83DC\u5355"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
      <h1 id="title">\u8D44\u6E90\u5BA1\u6838</h1>
      <button class="btn" onclick="runNow(this)">\u7ACB\u5373\u6293\u53D6</button>
      <button class="btn pri save" onclick="save(this)"><span class="dot"></span><span>\u4FDD\u5B58<span class="lbl-long">\u8BBE\u7F6E</span></span></button>
    </div>
    <div class="page">

      <!-- \u8D44\u6E90\u5BA1\u6838 -->
      <div class="panel" id="p-items">
        <div class="runbox" id="runBox"><header><span id="runTitle">\u6B63\u5728\u6293\u53D6</span><button class="btn sm" onclick="$('#runBox').style.display='none'">\u6536\u8D77</button></header><div class="prog"><i id="runProg"></i></div><pre id="runOut"></pre></div>
        <div class="tabs">
          <button data-st="approved" onclick="loadItems('approved')">\u5DF2\u901A\u8FC7<span class="n"></span></button>
          <button data-st="pending" onclick="loadItems('pending')">\u5F85\u5224\u5B9A<span class="n"></span></button>
          <button data-st="rejected" onclick="loadItems('rejected')">\u5DF2\u62D2\u7EDD<span class="n"></span></button>
          <span style="flex:1"></span>
          <button onclick="clearStatus()" style="color:var(--alert)">\u6E05\u7A7A\u5F53\u524D</button>
        </div>
        <div id="items" class="list"><div class="empty">\u52A0\u8F7D\u4E2D\u2026</div></div>
      </div>

      <!-- \u91C7\u96C6\u4E0E\u5206\u7C7B -->
      <div class="panel" id="p-collect">
        <div class="section">
          <header><h2>\u6536\u96C6\u54EA\u4E9B\u5206\u7C7B</h2><span class="hint" id="catCount"></span></header>
          <div class="body">
            <div class="cgrps" data-csv="enabled_categories" id="catBox"></div>
            <div class="row">
              <button class="btn sm" onclick="catAll('#catBox', true)">\u5168\u9009</button>
              <button class="btn sm" onclick="catAll('#catBox', false)">\u5168\u4E0D\u9009</button>
              <button class="btn sm" onclick="catPreset()">\u6062\u590D\u63A8\u8350</button>
              <span class="hint">\u5173\u952E\u8BCD\u9884\u7B5B\u3001AI \u5224\u5B9A\u3001\u641C\u7D22\u8BCD\u548C\u767D\u5AD6\u4E13\u6E90\u90FD\u8DDF\u7740\u52FE\u9009\u7684\u5206\u7C7B\u8D70\u3002</span>
            </div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u7B5B\u9009\u6761\u4EF6</h2></header>
          <div class="body">
            <label class="sw"><input type="checkbox" data-key="simple_signup_only" />\u53EA\u8981\u6CE8\u518C\u7B80\u5355\u7684\uFF08\u90AE\u7BB1 / GitHub / Google \u767B\u5F55\uFF1B\u4E0D\u8981\u7ED1\u5361\u3001\u624B\u673A\u9A8C\u8BC1\u3001\u5B9E\u540D\u3001\u9080\u8BF7\u7801\uFF09</label>
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
            <div class="row" style="gap:22px">
              <label class="sw"><input type="checkbox" data-key="filter_english" />\u8FC7\u6EE4\u7EAF\u82F1\u6587\u5185\u5BB9</label>
              <label class="sw"><input type="checkbox" data-key="noise_filter" />\u8DF3\u8FC7\u6C42\u52A9 / \u5410\u69FD\u5E16</label>
              <label class="sw"><input type="checkbox" data-key="keep_undated" />\u4FDD\u7559\u6CA1\u6709\u53D1\u5E03\u65E5\u671F\u7684</label>
            </div>
            <div class="grid2">
              <div><label class="f">\u53EA\u8981\u6700\u8FD1\u591A\u5C11\u5929\u53D1\u5E03\u7684</label><input type="number" data-key="max_age_days" min="1" /></div>
              <div><label class="f">\u6570\u636E\u4FDD\u7559\u5929\u6570\uFF08\u5230\u671F\u81EA\u52A8\u6E05\u7406\uFF09</label><input type="number" data-key="retention_days" min="1" max="365" /></div>
            </div>
            <div class="grid2">
              <div><label class="f">\u53D1\u5E03\u8D85\u8FC7\u591A\u5C11\u5929\u7B97\u300C\u8F83\u65E9\u53D1\u5E03\u300D</label><input type="number" data-key="fresh_days" min="1" max="365" /></div>
              <div class="hint" style="align-self:end;padding-bottom:8px">\u8D44\u6E90\u9875\u6309\u53D1\u5E03\u65F6\u95F4\u6392\u5E8F\uFF0C\u8D85\u8FC7\u8FD9\u4E2A\u5929\u6570\u7684\u5355\u72EC\u6298\u53E0\u5728\u6700\u540E\uFF1B\u90AE\u4EF6\u91CC\u4E5F\u5355\u72EC\u6210\u7EC4\u3002</div>
            </div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u8D28\u91CF\u63A7\u5236</h2></header>
          <div class="body">
            <div class="row" style="gap:22px">
              <label class="sw"><input type="checkbox" data-key="link_check" />\u5931\u6548\u68C0\u6D4B</label>
              <label class="sw"><input type="checkbox" data-key="search_strict" />\u641C\u7D22\u7ED3\u679C\u6807\u9898\u5FC5\u987B\u5199\u660E\u514D\u8D39</label>
            </div>
            <div class="grid3">
              <div><label class="f">\u6BCF\u6B21\u6293\u53D6\u540E\u62BD\u67E5\u51E0\u6761\u94FE\u63A5</label><input type="number" data-key="link_check_per_run" min="1" max="30" /></div>
              <div><label class="f">\u300C\u4E0D\u503C\u300D\u6BD4\u300C\u503C\u300D\u591A\u51E0\u7968\u81EA\u52A8\u9690\u85CF\uFF080 = \u4E0D\u9690\u85CF\uFF09</label><input type="number" data-key="vote_hide" min="0" max="100" /></div>
              <div class="hint" style="align-self:end;padding-bottom:8px">\u62BD\u67E5\u6253\u4E0D\u5F00\uFF08404\uFF09\u6216\u6807\u9898\u5199\u7740\u5DF2\u7ED3\u675F / \u5DF2\u5931\u6548\u7684\uFF0C\u6807\u4E3A\u300C\u53EF\u80FD\u5931\u6548\u300D\u6C89\u5230\u6700\u540E\u3002</div>
            </div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u8D44\u6E90\u9875\u677F\u5757</h2></header>
          <div class="body">
            <div class="grid2">
              <div><label class="f">\u7B7E\u5230\u6E05\u5355\uFF08\u6BCF\u884C\uFF1A\u540D\u79F0 | \u5730\u5740 | \u5907\u6CE8\uFF09</label><textarea data-key="checkin_sites" style="min-height:110px" placeholder="\u67D0\u67D0\u516C\u76CA\u7AD9 | https://example.com | \u6BCF\u5929\u7B7E\u5230\u9001 $1"></textarea></div>
              <div><label class="f">\u5B66\u751F / \u5F00\u53D1\u8005\u4E13\u533A\u8FFD\u52A0\uFF08\u6BCF\u884C\uFF1A\u540D\u79F0 | \u5730\u5740 | \u8BF4\u660E | \u5B66\u751F \u6216 \u5F00\u53D1\u8005\uFF09</label><textarea data-key="perks_extra" style="min-height:110px" placeholder="\u963F\u91CC\u4E91\u9AD8\u6821\u8BA1\u5212 | https://\u2026 | \u5B66\u751F\u8BA4\u8BC1\u9001\u4E91\u670D\u52A1\u5668 | \u5B66\u751F"></textarea></div>
            </div>
            <div class="hint">\u300C\u7B7E\u5230\u300D\u9875\u9664\u4E86\u8FD9\u4EFD\u6E05\u5355\uFF0C\u8FD8\u4F1A\u81EA\u52A8\u5217\u51FA\u6700\u8FD1\u6536\u5F55\u7684\u7B7E\u5230\u7C7B\u8D44\u6E90\uFF1B\u8BBF\u5BA2\u53EF\u4EE5\u5728\u9875\u9762\u4E0A\u52FE\u9009\u4ECA\u5929\u7B7E\u8FC7\u7684\uFF0C\u8BB0\u5728\u81EA\u5DF1\u7684\u6D4F\u89C8\u5668\u91CC\u3002\u4E13\u533A\u5DF2\u5185\u7F6E GitHub \u5B66\u751F\u5305\u3001JetBrains\u3001Cloudflare\u3001Oracle \u7B49\u957F\u671F\u6743\u76CA\u3002</div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u5B9A\u65F6\u4E0E\u89E6\u53D1</h2></header>
          <div class="body">
            <div class="grid3">
              <div><label class="f">\u591A\u4E45\u6293\u4E00\u6B21</label><select data-key="crawl_every_hours"><option value="2">\u6BCF 2 \u5C0F\u65F6</option><option value="3">\u6BCF 3 \u5C0F\u65F6</option><option value="4">\u6BCF 4 \u5C0F\u65F6</option><option value="6">\u6BCF 6 \u5C0F\u65F6</option><option value="8">\u6BCF 8 \u5C0F\u65F6</option><option value="12">\u6BCF 12 \u5C0F\u65F6</option><option value="24">\u6BCF\u5929\u4E00\u6B21</option></select></div>
              <div><label class="f">\u4ECE\u51E0\u70B9\u5F00\u59CB\uFF08\u5317\u4EAC\u65F6\u95F4 0-23\uFF09</label><input type="number" data-key="run_hour" min="0" max="23" /></div>
              <div><label class="f">\u6BCF\u6B21\u89E6\u53D1\u6267\u884C\u51E0\u6B65\uFF08\u514D\u8D39\u7248\u4FDD\u6301 1\uFF09</label><input type="number" data-key="steps_per_tick" min="1" max="50" /></div>
            </div>
            <div class="sched" id="crawlSched"></div>
            <div>
              <label class="f">\u89E6\u53D1\u5730\u5740\uFF08\u8BBF\u95EE\u4E00\u6B21\u63A8\u8FDB\u4E00\u6B65\uFF1B\u5230\u70B9\u81EA\u52A8\u5F00\u59CB\u5F53\u5929\u7684\u6293\u53D6\uFF09</label>
              <div class="row">
                <input class="grow" type="text" id="cronUrl" readonly onclick="this.select()" />
                <button class="btn" onclick="copyText($('#cronUrl').value, '\u5DF2\u590D\u5236\u89E6\u53D1\u5730\u5740')">\u590D\u5236</button>
                <button class="btn" onclick="hitCron(this)">\u8BBF\u95EE\u4E00\u6B21</button>
                <button class="btn" onclick="resetCronKey(this)">\u6362\u5BC6\u94A5</button>
              </div>
              <div class="hint" style="margin-top:6px">Cloudflare \u81EA\u5E26\u7684\u6BCF\u5206\u949F\u5B9A\u65F6\u5DF2\u7ECF\u591F\u7528\u3002\u60F3\u591A\u4E00\u5C42\u4FDD\u9669\uFF0C\u53EF\u4EE5\u628A\u8FD9\u4E2A\u5730\u5740\u586B\u5230 <a href="https://cron-job.org" target="_blank" rel="noopener">cron-job.org</a> \u6216 <a href="https://uptimerobot.com" target="_blank" rel="noopener">UptimeRobot</a>\uFF0C\u8BBE\u6210\u6BCF 1\u20135 \u5206\u949F\u8BBF\u95EE\u4E00\u6B21\u3002<span id="cronLast"></span></div>
            </div>
            <div class="grid3">
              <div><label class="f">\u89E6\u53D1\u6700\u5C0F\u95F4\u9694\uFF08\u79D2\uFF09</label><input type="number" data-key="trigger_min_seconds" min="5" /></div>
              <div><label class="f">\u8D44\u6E90\u9875\u7F13\u5B58\uFF08\u79D2\uFF0C0 = \u4E0D\u7F13\u5B58\uFF09</label><input type="number" data-key="public_cache_seconds" min="0" max="3600" /></div>
              <div><label class="f">\u6709\u4EBA\u6253\u5F00\u8D44\u6E90\u9875\u65F6</label><label class="sw" style="margin-top:8px"><input type="checkbox" data-key="visit_trigger" />\u987A\u5E26\u63A8\u8FDB\u4E00\u6B65</label></div>
            </div>
            <div class="hint">\u95F4\u9694\u5185\u7684\u89E6\u53D1\u8BF7\u6C42\u4F1A\u76F4\u63A5\u8FD4\u56DE\u3001\u4E0D\u6267\u884C\uFF0C\u9632\u6B62\u88AB\u9891\u7E41\u8BBF\u95EE\u62D6\u57AE\u3002\u7F13\u5B58\u671F\u5185\u8D44\u6E90\u9875\u4E0D\u67E5\u6570\u636E\u5E93\uFF0C\u6253\u5F00\u66F4\u5FEB\uFF1B\u540E\u53F0\u64CD\u4F5C\u540E\u7F13\u5B58\u4F1A\u7ACB\u5373\u5237\u65B0\u3002</div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u6570\u636E\u6E90</h2><span class="hint" id="srcCount"></span><span class="sp"></span><button class="btn sm" onclick="openSync(this)" title="\u4ECE\u5185\u7F6E\u63A8\u8350\u548C freebie-radar \u7B49\u5730\u5740\u62C9\u53D6\u65B0\u6E90">\u21BB \u66F4\u65B0\u6E90</button><button class="btn sm" onclick="openDiscover()" title="\u7528\u5DF2\u5F00\u542F\u7684\u641C\u7D22\u540E\u7AEF\u627E\u65B0\u7684\u8BA2\u9605\u6E90">\u2315 \u53D1\u73B0\u65B0\u6E90</button><button class="btn sm" onclick="openBatch()" title="\u4E00\u6B21\u7C98\u8D34\u591A\u4E2A\u7F51\u5740 / t.me \u94FE\u63A5 / @\u9891\u9053">\uFF0B \u6279\u91CF\u6DFB\u52A0</button></header>
          <div class="body" style="padding-top:12px">
            <div class="srcbar"><input type="text" id="srcQ" placeholder="\u641C\u7D22\u6E90\u540D\u79F0 / \u5730\u5740" oninput="renderSources()" /><select id="srcF" onchange="renderSources()"><option value="">\u5168\u90E8</option><option value="on">\u5DF2\u542F\u7528</option><option value="off">\u5DF2\u505C\u7528</option><option value="limited">\u9650\u5B9A\u4E86\u5206\u7C7B</option><option value="bad">\u8FD1 7 \u5929\u6709\u95EE\u9898</option></select><button class="btn sm" id="offBad" onclick="disableBad()" style="display:none">\u505C\u7528\u6709\u95EE\u9898\u7684\u6E90</button></div>
            <div class="srclist" id="srcList"></div>
            <div class="hint">\u70B9\u300C\u5206\u7C7B\u300D\u9650\u5B9A\u8FD9\u4E2A\u6E90\u53EA\u6536\u54EA\u4E9B\u5206\u7C7B\uFF0C\u5176\u5B83\u5206\u7C7B\u7684\u5185\u5BB9\u76F4\u63A5\u4E22\u5F03\uFF1B\u6CA1\u8BBE\u7F6E\u5C31\u8DDF\u968F\u4E0A\u9762\u52FE\u9009\u7684\u5206\u7C7B\u3002\u300C\u9ED8\u8BA4\u5206\u7C7B\u300D\u7528\u4E8E\u5173\u952E\u8BCD\u5F52\u4E0D\u4E86\u7C7B\u7684\u65F6\u5019\uFF08\u6BD4\u5982\u4E3B\u673A\u535A\u5BA2\u9ED8\u8BA4\u5F52\u5230\u4E3B\u673A / VPS\uFF09\u3002\u6293\u5230\u7684\u5185\u5BB9\u7167\u5E38\u7ECF\u8FC7\u65F6\u95F4\u3001\u4E2D\u6587\u3001\u566A\u97F3\u3001\u5C4F\u853D\u89C4\u5219\u3001\u5173\u952E\u8BCD\u548C AI \u8FC7\u6EE4\u3002</div>
            <details class="adv"><summary>\u66F4\u65B0\u6E90\u7684\u5730\u5740 / \u4EE5 JSON \u7F16\u8F91</summary>
              <label class="f" style="margin-top:10px">\u300C\u66F4\u65B0\u6E90\u300D\u4ECE\u8FD9\u4E9B\u5730\u5740\u62C9\u53D6\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF1B\u652F\u6301 freebie-radar \u7684 SEEDS \u6E90\u6587\u4EF6\uFF0C\u6216\u672C\u9879\u76EE\u683C\u5F0F\u7684 JSON \u6570\u7EC4\uFF09</label>
              <textarea data-key="source_sync_urls" style="min-height:64px"></textarea>
              <label class="f" style="margin-top:12px">\u5168\u90E8\u6570\u636E\u6E90\uFF08JSON\uFF09</label>
              <textarea data-key="sources" id="srcJson" style="min-height:260px"></textarea>
              <div class="hint">type\uFF1Arss\uFF08url\uFF09/ telegram\uFF08channel\uFF09/ repo\uFF08repo, mode: diff / sub\uFF09/ v2ex\uFF08node\uFF09/ hn\uFF08query\uFF09/ reddit\uFF08query, subreddit\uFF09/ github\uFF08query\uFF09/ epic / gamerpower / openrouter_free\u3002limit\uFF1A\u6BCF\u6B21\u6700\u591A\u53D6\u51E0\u6761\uFF1Bevery\uFF1A\u81F3\u5C11\u9694\u51E0\u5C0F\u65F6\u624D\u6293\u4E00\u6B21\uFF08\u9519\u5CF0\uFF09\u3002cats\uFF1A\u53EA\u6536\u8FD9\u4E9B\u5206\u7C7B\uFF1Bhint\uFF1A\u9ED8\u8BA4\u5206\u7C7B\uFF1Binclude\uFF1A\u6807\u9898\u5FC5\u987B\u5339\u914D\u7684\u6B63\u5219\uFF1Btrusted:true + category\uFF1A\u76F4\u63A5\u5165\u5E93\u4E0D\u9001 AI\uFF1Bai_only\uFF1A\u53EA\u5728\u914D\u7F6E\u4E86 AI \u65F6\u6293\u3002</div>
            </details>
          </div>
        </div>
      </div>

      <!-- AI \u4E0E\u641C\u7D22 -->
      <div class="panel" id="p-engine">
        <div class="section">
          <header><h2>AI \u5224\u5B9A <span class="tag" id="aiState"></span></h2><label class="sw"><input type="checkbox" data-key="ai_enabled" />\u542F\u7528</label></header>
          <div class="body">
            <div class="callout"><b>\u53EF\u9009\u3002</b>\u4E0D\u586B\u4E5F\u80FD\u7528\uFF0C\u4F1A\u6309\u5173\u952E\u8BCD\u5224\u5B9A\uFF1B\u586B\u597D\u63A5\u53E3\u5730\u5740\u3001Key \u548C\u6A21\u578B\u5E76\u4FDD\u5B58\u540E\uFF0C\u81EA\u52A8\u6539\u7528 AI\uFF0C\u7ED3\u679C\u66F4\u51C6\u3002\u652F\u6301\u4EFB\u4F55 OpenAI \u517C\u5BB9\u63A5\u53E3\uFF1AOpenAI\u3001DeepSeek\u3001OpenRouter\u3001\u7845\u57FA\u6D41\u52A8\u548C\u5404\u7C7B\u4E2D\u8F6C\u3002<span class="storageNote"></span></div>
            <div class="grid2">
              <div><label class="f">\u63A5\u53E3\u5730\u5740</label><input type="text" data-key="ai_base_url" placeholder="https://api.openai.com/v1" /></div>
              <div><label class="f">API Key</label><input type="password" data-key="ai_api_key" autocomplete="off" /></div>
            </div>
            <div>
              <label class="f">\u6A21\u578B</label>
              <div class="row">
                <input class="grow" type="text" data-key="ai_model" list="ai-models" placeholder="\u624B\u52A8\u8F93\u5165\uFF0C\u6216\u83B7\u53D6\u5217\u8868\u540E\u9009\u62E9" />
                <datalist id="ai-models"></datalist>
                <select id="ai-select" class="grow" onchange="pick('ai', this.value)"><option value="">\u2014 \u6A21\u578B\u5217\u8868 \u2014</option></select>
                <button class="btn" onclick="fetchModels('ai', this)">\u83B7\u53D6\u6A21\u578B</button>
                <button class="btn" onclick="testModel('ai', this)">\u6D4B\u8BD5</button>
              </div>
            </div>
            <div class="grid2">
              <div><label class="f">\u5BA1\u6838\u65B9\u5F0F</label><select data-key="ai_review"><option value="smart">\u667A\u80FD\uFF08\u63A8\u8350\uFF09\uFF1A\u628A\u63E1\u5927\u7684\u81EA\u52A8\u5B9A\uFF0C\u62FF\u4E0D\u51C6\u7684\u624D\u95EE AI</option><option value="all">\u4E25\u683C\uFF1A\u6BCF\u4E00\u6761\u90FD\u4EA4\u7ED9 AI</option></select></div>
              <div class="hint" style="align-self:end;padding-bottom:8px">\u667A\u80FD\u6A21\u5F0F\u4E0B\uFF0C\u6807\u9898\u5199\u660E\u514D\u8D39\u3001\u80FD\u5F52\u7C7B\u3001\u6CA1\u6709\u4EF7\u683C / \u62BD\u5956 / \u63A8\u5E7F\u5B57\u6837\u7684\u76F4\u63A5\u901A\u8FC7\uFF0C\u63D0\u95EE\u5E16\u548C\u660E\u786E\u4ED8\u8D39\u7684\u76F4\u63A5\u62D2\u7EDD\uFF0C\u5176\u4F59\u624D\u6D88\u8017 AI \u989D\u5EA6\u3002</div>
            </div>
            <details>
              <summary class="hint" style="cursor:pointer">\u66F4\u591A\uFF1A\u6279\u91CF\u5927\u5C0F\u3001\u5224\u5B9A\u4E0A\u9650\u3001\u901A\u8FC7\u5206\u6570\u3001\u91CD\u65B0\u5224\u5B9A</summary>
              <div class="grid3" style="margin-top:12px">
                <div><label class="f">\u6BCF\u6B21\u8BF7\u6C42\u5224\u5B9A\u6761\u6570</label><input type="number" data-key="ai_batch_size" min="1" max="20" /></div>
                <div><label class="f">\u6BCF\u6B21\u8FD0\u884C\u6700\u591A\u5224\u5B9A</label><input type="number" data-key="ai_max_items" min="1" /></div>
                <div><label class="f">\u6700\u4F4E\u901A\u8FC7\u5206\u6570</label><input type="number" data-key="ai_min_score" min="0" max="100" /></div>
              </div>
              <label class="sw" style="margin-top:12px"><input type="checkbox" data-key="ai_cache" />\u540C\u4E00\u4E2A\u76EE\u6807\u5730\u5740\u5224\u8FC7\u4E00\u6B21\u5C31\u590D\u7528\u7ED3\u8BBA\uFF08\u7701\u989D\u5EA6\uFF09</label>
              <div class="row" style="margin-top:12px"><button class="btn" onclick="rejudge(this)">\u7528 AI \u91CD\u65B0\u5224\u5B9A</button><span class="hint">\u628A\u4E4B\u524D\u7528\u5173\u952E\u8BCD\u5224\u8FC7\u7684\u6761\u76EE\u4EA4\u7ED9 AI \u518D\u5224\u4E00\u904D\u3002</span></div>
            </details>
          </div>
        </div>
        <div class="section">
          <header><h2>\u8054\u7F51\u641C\u7D22 <span class="tag" id="searchState"></span></h2></header>
          <div id="searchBackends"></div>
        </div>
        <div class="section">
          <header><h2>\u641C\u7D22\u504F\u597D</h2><span class="sp"></span><button class="btn sm" onclick="openDiscover()">\u2315 \u7528\u641C\u7D22\u53D1\u73B0\u65B0\u8BA2\u9605\u6E90</button></header>
          <div class="body">
            <div class="grid3">
              <div><label class="f">\u8BED\u8A00</label><select data-key="search_lang"><option value="zh_only">\u53EA\u8981\u4E2D\u6587</option><option value="zh_first">\u4E2D\u6587\u4F18\u5148</option><option value="any">\u4E0D\u9650</option></select></div>
              <div><label class="f">\u6BCF\u6B21\u6700\u591A\u67E5\u51E0\u4E2A\u8BCD</label><input type="number" data-key="search_max_queries" min="1" max="20" /></div>
              <div><label class="f">\u6BCF\u4E2A\u8BCD\u8FD4\u56DE\u6761\u6570</label><input type="number" data-key="search_max_results" min="1" max="50" /></div>
            </div>
            <div class="grid2">
              <div><label class="f">\u81EA\u5B9A\u4E49\u641C\u7D22\u8BCD\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF1B\u7559\u7A7A\u6309\u5206\u7C7B\u81EA\u52A8\u751F\u6210\uFF09</label><textarea data-key="search_queries"></textarea></div>
              <div><label class="f">\u5C4F\u853D\u7AD9\u70B9\uFF08\u6BCF\u884C\u4E00\u4E2A\u57DF\u540D\uFF0C\u5BF9\u6240\u6709\u6765\u6E90\u751F\u6548\uFF09</label><textarea data-key="search_block_domains"></textarea></div>
            </div>
            <div class="hint">\u5F00\u542F\u7684\u51E0\u5BB6\u5E76\u884C\u641C\u7D22\uFF08\u514D\u8D39\u7248\u6BCF\u6B65\u5E76\u884C 2 \u5BB6\uFF09\u3002\u63A5\u53E3\u8D44\u6599\u53C2\u8003 <a href="https://github.com/bestnite/search" target="_blank" rel="noopener">bestnite/search</a>\u3002</div>
          </div>
        </div>
        <div class="section">
          <header><h2>AI \u798F\u5229\u96F7\u8FBE</h2><label class="sw"><input type="checkbox" data-key="aifree_radar" />\u542F\u7528</label></header>
          <div class="body">
            <div class="callout">\u6BCF\u6B21\u6293\u53D6\u989D\u5916\u8DD1\u4E00\u6B65\uFF1A\u7528\u4E0A\u9762\u5F00\u542F\u7684\u641C\u7D22\u540E\u7AEF\uFF0C\u6309\u300C\u798F\u5229\u8BCD + \u8F6E\u5230\u7684\u51E0\u4E2A\u5382\u5546\u300D\u53BB\u641C\uFF0C\u7ED3\u679C\u53EA\u6536\u8FDB\u300CAI \u514D\u8D39\u989D\u5EA6 / AI \u9650\u65F6\u798F\u5229\u300D\uFF0C\u518D\u7ECF\u8FC7\u514D\u8D39\u8BCD\u3001\u4E2D\u6587\u3001\u5C4F\u853D\u89C4\u5219\u548C AI \u5224\u5B9A\uFF0C\u6574\u7406\u6210 \u5382\u5546 \xB7 \u798F\u5229\u7C7B\u578B \xB7 \u600E\u4E48\u9886 \xB7 \u622A\u6B62\u65F6\u95F4\u3002\u914D\u4E86 AI \u6548\u679C\u6700\u597D\u3002</div>
            <div class="grid2">
              <div><label class="f">\u798F\u5229\u641C\u7D22\u8BCD\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF0C\u6BCF\u8F6E\u8F6E\u6362\u7740\u7528\uFF09</label><textarea data-key="aifree_queries" style="min-height:130px"></textarea></div>
              <div><label class="f">\u5173\u6CE8\u7684\u5382\u5546 / \u4EA7\u54C1\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF0C\u6BCF\u8F6E\u8F6E\u5230\u51E0\u4E2A\uFF0C\u641C\u300Cxx \u514D\u8D39 \u989D\u5EA6 \u798F\u5229\u300D\uFF09</label><textarea data-key="aifree_vendors" style="min-height:130px"></textarea></div>
            </div>
            <div class="grid3">
              <div><label class="f">\u6BCF\u8F6E\u8F6E\u5230\u51E0\u4E2A\u5382\u5546</label><input type="number" data-key="aifree_vendors_per_run" min="0" max="8" /></div>
              <div><label class="f">\u53EA\u8981\u6700\u8FD1\u591A\u5C11\u5929\u7684</label><input type="number" data-key="aifree_days" min="1" max="180" /></div>
              <div class="hint" style="align-self:end;padding-bottom:8px">\u6BCF\u8F6E\u7684\u641C\u7D22\u8BCD\u603B\u6570\u8DDF\u300C\u6BCF\u6B21\u6700\u591A\u67E5\u51E0\u4E2A\u8BCD\u300D\u4E00\u81F4\uFF0C\u514D\u8D39\u7248\u5EFA\u8BAE\u4E0D\u8D85\u8FC7 6\u3002</div>
            </div>
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
              <div><label class="f">\u6BCF\u5929\u51E0\u70B9\u63A8\u9001\uFF08\u5317\u4EAC\u65F6\u95F4\uFF09</label><input type="text" data-key="mail_hours" placeholder="9,21" /></div>
            </div>
            <div class="pills" id="mailHourPills" style="margin-top:-8px"></div>
            <div class="sched" id="mailSched" style="margin-top:-8px"></div>
            <div>
              <label class="f">\u6536\u4EF6\u4EBA\uFF08\u8F93\u5165\u540E\u6309\u56DE\u8F66\u6216\u9017\u53F7\u6DFB\u52A0\uFF0C\u6700\u591A 10 \u4E2A\uFF09</label>
              <div class="rcpt" id="rcpt" onclick="$('#rcptIn').focus()"><input id="rcptIn" type="text" placeholder="\u6DFB\u52A0\u90AE\u7BB1\uFF0C\u5982 me@qq.com" autocomplete="off" /></div>
              <input type="hidden" data-key="mail_to" />
              <label class="sw" style="margin-top:10px"><input type="checkbox" data-key="mail_separate" />\u6BCF\u4EBA\u5355\u72EC\u53D1\u4E00\u5C01\uFF08\u6536\u4EF6\u4EBA\u4E4B\u95F4\u770B\u4E0D\u5230\u5F7C\u6B64\u7684\u5730\u5740\uFF09</label>
            </div>
            <div data-show="mail_provider=smtp" class="grid3">
              <div><label class="f">QQ \u90AE\u7BB1\u8D26\u53F7</label><input type="text" data-key="smtp_user" placeholder="123456@qq.com" /></div>
              <div><label class="f">\u6388\u6743\u7801\uFF08\u4E0D\u662F QQ \u5BC6\u7801\uFF09</label><input type="password" data-key="smtp_pass" autocomplete="off" /></div>
              <div><label class="f">\u53D1\u4EF6\u5730\u5740\uFF08\u7559\u7A7A = \u8D26\u53F7\uFF09</label><input type="text" data-key="mail_from" /></div>
            </div>
            <div data-show="mail_provider=smtp" class="hint">QQ \u90AE\u7BB1 \u2192 \u8BBE\u7F6E \u2192 \u8D26\u53F7\u4E0E\u5B89\u5168 \u2192 \u5B89\u5168\u8BBE\u7F6E \u2192 \u5F00\u542F POP3/IMAP/SMTP \u670D\u52A1\uFF0C\u751F\u6210\u6388\u6743\u7801\u3002</div>
            <details data-show="mail_provider=smtp">
              <summary class="hint" style="cursor:pointer">\u66F4\u6539 SMTP \u670D\u52A1\u5668\uFF08\u7528 QQ \u90AE\u7BB1\u4E0D\u7528\u52A8\uFF09</summary>
              <div class="grid3" style="margin-top:12px">
                <div><label class="f">SMTP \u670D\u52A1\u5668</label><input type="text" data-key="smtp_host" /></div>
                <div><label class="f">\u7AEF\u53E3</label><input type="number" data-key="smtp_port" /></div>
                <div><label class="f">\u52A0\u5BC6</label><select data-key="smtp_secure"><option value="ssl">SSL\uFF08465\uFF09</option><option value="starttls">STARTTLS\uFF08587\uFF09</option></select></div>
              </div>
            </details>
            <div data-show="mail_provider=resend,brevo" class="grid2">
              <div><label class="f">API Key</label><input type="password" data-key="mail_api_key" autocomplete="off" /></div>
              <div><label class="f">\u53D1\u4EF6\u5730\u5740\uFF08\u9700\u5DF2\u9A8C\u8BC1\u57DF\u540D\uFF09</label><input type="text" data-key="mail_from" /></div>
            </div>
            <div data-show="mail_provider=cloudflare" class="hint">\u9700\u8981\u53D6\u6D88 wrangler.toml \u4E2D [[send_email]] \u7684\u6CE8\u91CA\uFF0C\u53D1\u4EF6\u57DF\u540D\u5F00\u542F Email Routing\uFF0C\u6536\u4EF6\u4EBA\u5728 Email Routing \u4E2D\u9A8C\u8BC1\u3002</div>
            <div class="grid3">
              <div><label class="f">\u53D1\u4EF6\u4EBA\u540D\u79F0</label><input type="text" data-key="mail_from_name" /></div>
              <div><label class="f">\u6807\u9898</label><input type="text" data-key="mail_subject" /></div>
              <div><label class="f">\u6BCF\u5C01\u6700\u591A\u6761\u6570</label><input type="number" data-key="mail_max_items" min="1" max="200" /></div>
            </div>
            <div class="row">
              <button class="btn" onclick="mailPreview(this)">\u9884\u89C8\u90AE\u4EF6</button>
              <button class="btn" onclick="pushAction('test', 'mail', this)">\u53D1\u9001\u6D4B\u8BD5\u90AE\u4EF6</button>
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
        <div class="section">
          <header><h2>\u5FAE\u4FE1 / \u9489\u9489 / \u98DE\u4E66 / Bark \u7B49\u673A\u5668\u4EBA</h2></header>
          <div class="body"><div id="pushRows"></div><div class="hint">\u586B\u4E86\u5730\u5740\u5C31\u4F1A\u5728\u63A8\u9001\u65F6\u95F4\u4E00\u8D77\u63A8\u9001\uFF1B\u5F00\u5173\u53EF\u4EE5\u5355\u72EC\u505C\u7528\u67D0\u4E2A\u6E20\u9053\u3002\u5730\u5740\u548C Key \u548C\u5176\u5B83\u5BC6\u94A5\u4E00\u6837\u6253\u7801\u4FDD\u5B58\u3002</div></div>
        </div>
        <div class="section">
          <header><h2>\u5173\u952E\u8BCD\u63D0\u9192</h2><label class="sw"><input type="checkbox" data-key="watch_enabled" />\u542F\u7528</label></header>
          <div class="body">
            <div><label class="f">\u5173\u6CE8\u7684\u5173\u952E\u8BCD\uFF08\u6BCF\u884C\u4E00\u4E2A\uFF09</label><textarea data-key="watch_keywords" style="min-height:90px" placeholder="Claude&#10;\u57DF\u540D&#10;VPS"></textarea></div>
            <div class="hint">\u6BCF\u6B21\u6293\u53D6\u7ED3\u675F\u540E\uFF0C\u65B0\u901A\u8FC7\u7684\u6761\u76EE\u53EA\u8981\u6807\u9898\u3001\u540D\u79F0\u6216\u7B80\u4ECB\u91CC\u6709\u8FD9\u4E9B\u8BCD\uFF0C\u5C31\u7ACB\u523B\u5355\u72EC\u63A8\u9001\u4E00\u6B21\uFF0C\u4E0D\u7528\u7B49\u65E5\u62A5\u3002</div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u6BCF\u5468\u7CBE\u9009</h2><label class="sw"><input type="checkbox" data-key="weekly_enabled" />\u542F\u7528</label></header>
          <div class="body">
            <div class="grid2">
              <div><label class="f">\u6BCF\u5468\u51E0\u63A8\u9001\uFF08\u968F\u5F53\u5929\u7B2C\u4E00\u6B21\u63A8\u9001\u4E00\u8D77\u53D1\uFF09</label><select data-key="weekly_weekday"><option value="1">\u5468\u4E00</option><option value="2">\u5468\u4E8C</option><option value="3">\u5468\u4E09</option><option value="4">\u5468\u56DB</option><option value="5">\u5468\u4E94</option><option value="6">\u5468\u516D</option><option value="0">\u5468\u65E5</option></select></div>
              <div class="hint" style="align-self:end;padding-bottom:8px">\u8FD1 7 \u5929\u91CC\u6309 AI \u8BC4\u5206\u3001\u300C\u503C / \u4E0D\u503C\u300D\u6295\u7968\u3001\u88AB\u51E0\u4E2A\u6765\u6E90\u63D0\u5230\u6311\u51FA 10 \u6761\uFF0C\u6BCF\u4E2A\u5206\u7C7B\u6700\u591A 3 \u6761\u3002\u8D44\u6E90\u9875\u7684\u300C\u5468\u62A5\u300D\u9875\u7B7E\u4E5F\u662F\u8FD9\u4E00\u4EFD\u3002</div>
            </div>
            <div class="row"><button class="btn" onclick="weeklyAction(this)">\u7ACB\u5373\u63A8\u9001\u4E00\u4EFD\u672C\u5468\u7CBE\u9009</button></div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u63A8\u9001\u5185\u5BB9</h2></header>
          <div class="body">
            <div class="row" style="gap:22px">
              <label class="sw"><input type="checkbox" data-key="mail_only_new" />\u53EA\u63A8\u4E0A\u6B21\u4E4B\u540E\u65B0\u901A\u8FC7\u7684</label>
              <label class="sw"><input type="checkbox" data-key="mail_send_empty" />\u6CA1\u6709\u65B0\u5185\u5BB9\u4E5F\u63A8</label>
            </div>
            <div><label class="f">\u63A8\u9001\u54EA\u4E9B\u5206\u7C7B\uFF08\u90FD\u4E0D\u52FE = \u4E0E\u6536\u96C6\u7684\u76F8\u540C\uFF09</label><div class="cgrps" data-csv="mail_categories" id="mailCatBox"></div></div>
            <div><label class="f">\u8D44\u6E90\u9875\u5730\u5740\uFF08\u90AE\u4EF6\u5E95\u90E8\u201C\u67E5\u770B\u5168\u90E8\u201D\uFF0C\u9996\u6B21\u767B\u5F55\u540E\u53F0\u65F6\u81EA\u52A8\u586B\u5199\uFF09</label><input type="text" data-key="mail_site_url" placeholder="https://xxx.workers.dev" /></div>
            <div class="row"><button class="btn pri" onclick="pushAction('send', null, this)">\u7ACB\u5373\u63A8\u9001\u65E5\u62A5</button><span class="hint">\u5230\u4E86\u63A8\u9001\u65F6\u95F4\u6309\u542F\u7528\u7684\u6E20\u9053\u81EA\u52A8\u63A8\u9001\u3002</span></div>
          </div>
        </div>
      </div>

      <!-- \u9AD8\u7EA7\u89C4\u5219 -->
      <div class="panel" id="p-rules">
        <p class="desc">\u4E00\u822C\u4E0D\u7528\u6539\u3002\u5206\u7C7B\u81EA\u5E26\u5173\u952E\u8BCD\uFF0C\u4E0B\u9762\u53EA\u662F\u8865\u5145\u3002</p>
        <div class="section">
          <header><h2>\u5C4F\u853D\u89C4\u5219</h2></header>
          <div class="body">
            <div><label class="f">\u6BCF\u884C\u4E00\u6761\uFF1A\u5173\u952E\u8BCD\u6216 /\u6B63\u5219/\uFF0C\u547D\u4E2D\u76F4\u63A5\u4E22\u5F03\uFF0C\u4E0D\u9001 AI</label><textarea data-key="block_rules"></textarea></div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u5173\u952E\u8BCD\u9884\u7B5B</h2></header>
          <div class="body">
            <div class="grid3">
              <div><label class="f">\u989D\u5916\u4E3B\u9898\u8BCD</label><textarea data-key="topic_keywords"></textarea></div>
              <div><label class="f">\u514D\u8D39\u8BCD\uFF08\u547D\u4E2D\u5176\u4E00\uFF09</label><textarea data-key="free_keywords"></textarea></div>
              <div><label class="f">\u590D\u6742\u6CE8\u518C\u8BCD\uFF08\u547D\u4E2D\u5373\u4E22\u5F03\uFF09</label><textarea data-key="hard_signup_keywords"></textarea></div>
            </div>
          </div>
        </div>
      </div>

      <!-- \u8D26\u53F7\u4E0E\u5B89\u5168 -->
      <div class="panel" id="p-account">
        <div class="section">
          <header><h2>\u8D44\u6E90\u9875\u8BBF\u95EE\u5BC6\u7801</h2><span class="tag" id="siteLockState"></span></header>
          <div class="body">
            <div class="row">
              <input class="grow" type="password" id="sitePw" placeholder="\u8BBE\u7F6E\u540E\uFF0C\u6253\u5F00\u8D44\u6E90\u9875\u8981\u5148\u8F93\u5165\u5BC6\u7801" autocomplete="new-password" />
              <button class="btn" onclick="setSitePw(this, true)">\u8BBE\u7F6E</button>
              <button class="btn" onclick="setSitePw(this, false)">\u53D6\u6D88\u5BC6\u7801</button>
            </div>
            <div class="hint">\u7559\u7A7A\u5219\u8D44\u6E90\u9875\u516C\u5F00\u3002\u8BBE\u7F6E\u540E RSS \u5730\u5740\u6539\u4E3A <code>/feed.xml?key=\u8BBF\u95EE\u5BC6\u7801</code>\u3002\u7BA1\u7406\u540E\u53F0\u4ECD\u7528\u7BA1\u7406\u5458\u5BC6\u7801\u3002</div>
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
        <div class="section">
          <header><h2>\u767B\u5F55\u4E0E\u63A5\u53E3\u4FDD\u62A4</h2></header>
          <div class="body">
            <div class="grid2">
              <div><label class="f">\u540C\u4E00 IP 15 \u5206\u949F\u5185\u5BC6\u7801\u9519\u51E0\u6B21\u5C31\u9501\u5B9A</label><input type="number" data-key="login_max_fails" min="3" max="100" /></div>
              <div><label class="f">\u516C\u5F00\u63A5\u53E3\u6BCF\u4E2A IP \u6BCF\u5206\u949F\u6700\u591A\u8BF7\u6C42\uFF080 = \u4E0D\u9650\uFF09</label><input type="number" data-key="api_rate_per_min" min="0" max="10000" /></div>
            </div>
            <div class="hint">\u540E\u53F0\u548C\u8D44\u6E90\u9875\u8BBF\u95EE\u5BC6\u7801\u90FD\u53D7\u9501\u5B9A\u4FDD\u62A4\u3002\u6295\u7968\u63A5\u53E3\u53E6\u5916\u9650\u5236\u6BCF\u5206\u949F 30 \u6B21\u3002</div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u5907\u4EFD\u4E0E\u8FC1\u79FB</h2></header>
          <div class="body">
            <div class="row">
              <button class="btn" onclick="exportCfg(this, false)">\u5BFC\u51FA\u8BBE\u7F6E</button>
              <button class="btn" onclick="exportCfg(this, true)">\u5BFC\u51FA\u8BBE\u7F6E\uFF08\u542B\u5BC6\u94A5\uFF09</button>
              <button class="btn" onclick="$('#importFile').click()">\u5BFC\u5165\u5907\u4EFD\u2026</button>
              <input type="file" id="importFile" accept="application/json,.json" style="display:none" onchange="importCfg(this)" />
            </div>
            <div class="hint">\u5BFC\u51FA\u7684\u662F\u5168\u90E8\u8BBE\u7F6E\u548C\u6570\u636E\u6E90\uFF08JSON \u6587\u4EF6\uFF09\uFF0C\u6362\u8D26\u53F7\u6216\u91CD\u65B0\u90E8\u7F72\u540E\u5BFC\u5165\u5373\u53EF\uFF0C\u4E0D\u7528\u91CD\u65B0\u914D\u7F6E\u3002\u542B\u5BC6\u94A5\u7684\u6587\u4EF6\u91CC\u6709 AI Key\u3001\u90AE\u7BB1\u6388\u6743\u7801\u7B49\uFF0C\u8BF7\u59A5\u5584\u4FDD\u7BA1\u3002\u8D44\u6E90\u6570\u636E\u4E0D\u5728\u5907\u4EFD\u91CC\uFF0C\u91CD\u65B0\u6293\u53D6\u4E00\u6B21\u5C31\u6709\u3002</div>
          </div>
        </div>
        <div class="section">
          <header><h2>\u5B58\u50A8</h2></header>
          <div class="body">
            <div id="storageInfo" class="hint"></div>
            <div class="hint">\u8D44\u6E90\u6309\u6293\u53D6\u65E5\u671F\uFF08\u5317\u4EAC\u65F6\u95F4\uFF09\u5B58\u50A8\uFF0C\u5230\u671F\u81EA\u52A8\u6E05\u7406\uFF1B\u201C\u5DF2\u89C1\u8FC7\u201D\u7684\u94FE\u63A5\u8BB0\u5F55\u4FDD\u7559\u5230\u6700\u5927\u6D88\u606F\u5E74\u9F84\uFF0C\u907F\u514D\u91CD\u590D\u63A8\u9001\u3002</div>
          </div>
        </div>
      </div>

      <!-- \u8FD0\u884C\u8BB0\u5F55 -->
      <div class="panel" id="p-runs"><div id="runs"><div class="empty">\u52A0\u8F7D\u4E2D\u2026</div></div></div>
    </div>
  </main>
</div>
<div class="savebar"><span class="txt" id="dirtyTxt">\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539</span><button class="btn" onclick="revert()">\u64A4\u9500</button><button class="btn acc" onclick="save(this)">\u4FDD\u5B58</button></div>
<div class="modal" id="syncModal" onclick="if(event.target===this)closeSync()">
  <div class="mbox">
    <header><b id="syncTitle">\u66F4\u65B0\u6E90</b><span class="hint" id="syncSum"></span><span class="sp"></span><button class="btn sm" onclick="syncAll(true)">\u5168\u9009</button><button class="btn sm" onclick="syncAll(false)">\u53EA\u9009\u63A8\u8350</button><button class="x" onclick="closeSync()" aria-label="\u5173\u95ED">\xD7</button></header>
    <div class="mtop" id="syncTop"></div>
    <div class="mbody" id="syncBody"></div>
    <footer><span class="hint" id="syncErr"></span><span class="sp"></span><button class="btn" onclick="closeSync()">\u53D6\u6D88</button><button class="btn pri" id="syncAdd" onclick="applySync()">\u6DFB\u52A0\u9009\u4E2D</button></footer>
  </div>
</div>
<div id="toast"></div>

<script>
let TOKEN = localStorage.getItem('frr_token') || '';
let CUR = 'approved';
let SETTINGS = {};
let SNAP = {};
const TITLES = { items: '\u8D44\u6E90\u5BA1\u6838', collect: '\u91C7\u96C6\u4E0E\u5206\u7C7B', engine: 'AI \u4E0E\u641C\u7D22', push: '\u63A8\u9001', rules: '\u9AD8\u7EA7\u89C4\u5219', runs: '\u8FD0\u884C\u8BB0\u5F55', account: '\u8D26\u53F7\u4E0E\u5B89\u5168' };
const ALIAS = { ai: 'engine', search: 'engine', cats: 'collect' };
const CATS = /*__CATS__*/[];
const BACKENDS = /*__BACKENDS__*/[];
const GROUPS = /*__GROUPS__*/[];
const PUSH = /*__PUSH__*/[];
const CAT = Object.fromEntries(CATS.map((c) => [c.key, c.label]));
const REC = ['domain', 'hosting', 'cloud', 'ai', 'aideal', 'aitool', 'software', 'dev', 'game', 'edu', 'ainews', 'news', 'proxy'];
const OB = { free: '\u76F4\u63A5\u767D\u5AD6', conditional: '\u6709\u6761\u4EF6', lottery: '\u62BD\u5956', trial: '\u8BD5\u7528', promo: '\u63A8\u5E7F', paid: '\u9700\u4ED8\u8D39' };
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (t) => (t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '\u2014');
function ago(t) {
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return '\u521A\u521A';
  if (m < 60) return m + ' \u5206\u949F\u524D';
  if (m < 1440) return Math.round(m / 60) + ' \u5C0F\u65F6\u524D';
  return Math.round(m / 1440) + ' \u5929\u524D';
}
function toast(msg, ms = 3200, kind = '') { const t = $('#toast'); t.textContent = msg; t.className = 'on ' + kind; clearTimeout(t._h); t._h = setTimeout(() => (t.className = ''), ms); }
function drawer(on) { document.body.classList.toggle('drawer', on); }
function copyText(t, msg) { navigator.clipboard?.writeText(t).then(() => toast(msg || '\u5DF2\u590D\u5236', 2000, 'ok'), () => toast('\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u9009\u4E2D\u590D\u5236')); }

function renderBackends() {
  $('#searchBackends').innerHTML = BACKENDS.map((b) => '<div class="be" id="be-' + b.id + '">' +
    '<div><div class="nm">' + esc(b.name) + (b.keyless ? '<span class="tag free">\u514D Key</span>' : '') + (b.zh ? '<span class="tag zh">\u4E2D\u6587</span>' : '') + '<span class="tag st"></span></div>' +
    '<div class="q">' + esc(b.free) + (b.note ? ' \xB7 ' + esc(b.note) : '') + '</div></div>' +
    '<div><input type="password" data-key="' + b.id + '_api_key" autocomplete="off" placeholder="' + (b.keyless ? 'API Key\uFF08\u53EF\u9009\uFF0C\u7559\u7A7A\u8D70\u514D\u8D39\u63A5\u53E3\uFF09' : '\u586B API Key \u540E\u81EA\u52A8\u53C2\u4E0E') + '" /></div>' +
    '<div class="ops"><label class="sw"><input type="checkbox" data-key="' + b.id + '_enabled" /></label><button class="btn sm" onclick="testSearch(\\'' + b.id + '\\', this)">\u6D4B\u8BD5</button></div>' +
    '<div class="ln"><span class="becats" onclick="toggleBeCats(\\'' + b.id + '\\')" title="\u8FD9\u4E2A\u540E\u7AEF\u53EA\u641C\u8FD9\u4E9B\u5206\u7C7B">\u8D1F\u8D23\u5206\u7C7B\uFF1A<b></b> \u25BE</span><input type="hidden" data-key="' + b.id + '_cats" /><a href="' + esc(b.signup) + '" target="_blank" rel="noopener">' + (b.keyless ? '\u6CE8\u518C\u62FF Key\uFF08\u63D0\u9AD8\u989D\u5EA6\uFF09' : '\u53BB\u6CE8\u518C\u62FF\u514D\u8D39 API Key') + ' \u2197</a></div>' +
    '<div class="bce" style="display:none"></div>' +
    '<pre class="out" style="display:none"></pre></div>').join('');
}
function backendStates() {
  let on = 0;
  for (const b of BACKENDS) {
    const en = field(b.id + '_enabled').checked, key = field(b.id + '_api_key').value;
    const ready = en && (b.keyless || key);
    if (ready) on++;
    const st = $('#be-' + b.id + ' .st'), row = $('#be-' + b.id);
    st.textContent = ready ? '\u53C2\u4E0E\u641C\u7D22' : !en ? '\u5DF2\u5173\u95ED' : '\u5F85\u586B Key';
    st.className = 'tag st ' + (ready ? 'on' : 'off');
    row.classList.toggle('off', !ready);
  }
  $('#searchState').textContent = on + ' \u5BB6\u53EF\u7528';
  $('#searchState').className = 'tag ' + (on ? 'on' : 'off');
  const aiOn = field('ai_enabled').checked && field('ai_base_url').value && field('ai_api_key').value && field('ai_model').value;
  $('#aiState').textContent = aiOn ? '\u4F7F\u7528 AI' : '\u5173\u952E\u8BCD\u5224\u5B9A';
  $('#aiState').className = 'tag ' + (aiOn ? 'on' : 'off');
  try { const l = JSON.parse(field('sources').value); $('#srcCount').textContent = '\u542F\u7528 ' + l.filter((x) => x.enabled !== false).length + ' / \u5171 ' + l.length + ' \u4E2A'; } catch { $('#srcCount').textContent = 'JSON \u683C\u5F0F\u6709\u8BEF'; }
  for (const b of BACKENDS) { const v = field(b.id + '_cats').value; $('#be-' + b.id + ' .becats b').textContent = catSummary(v ? v.split(',') : []); }
}
function renderCats() {
  const tile = (c, mini) => '<label class="cat" title="' + esc(c.kw.join(' \xB7 ')) + '"><input type="checkbox" value="' + c.key + '"><span class="ic" style="background:' + c.color + '"></span><span class="tx"><b>' + c.label + '</b>' + (mini ? '' : '<small>' + esc(c.kw.join(' \xB7 ') || '\u5176\u5B83\u672A\u5F52\u7C7B\u7684\u514D\u8D39\u8D44\u6E90') + '</small>') + '</span><span class="ck">\u2713</span></label>';
  const list = CATS.filter((c) => c.key !== 'other');
  // \u6309\u680F\u76EE\u5206\u7EC4\uFF0C\u6BCF\u7EC4\u53EF\u4EE5\u6574\u7EC4\u52FE\u9009
  const grouped = (mini) => GROUPS.map((g) => {
    const cs = list.filter((c) => c.group === g.key);
    if (!cs.length) return '';
    return '<div class="cgrp"><div class="cgh"><b>' + esc(g.label) + '</b><span class="hint">' + cs.length + ' \u4E2A\u5206\u7C7B</span><button type="button" class="btn sm" onclick="grpToggle(this)">\u6574\u7EC4\u52FE\u9009</button></div><div class="cats' + (mini ? ' mini' : '') + '">' + cs.map((c) => tile(c, mini)).join('') + '</div></div>';
  }).join('');
  $('#catBox').innerHTML = grouped(false);
  $('#mailCatBox').innerHTML = grouped(true);
  grpLabels();
}
function grpToggle(btn) {
  const box = btn.closest('.cgrp');
  const ins = [...box.querySelectorAll('input')];
  const on = !ins.every((i) => i.checked);
  ins.forEach((i) => (i.checked = on));
  onEdit();
}
function grpLabels() { $$('.cgrp').forEach((g) => { const ins = [...g.querySelectorAll('input')]; const n = ins.filter((i) => i.checked).length; g.querySelector('.cgh .btn').textContent = n === ins.length ? '\u6574\u7EC4\u53D6\u6D88' : '\u6574\u7EC4\u52FE\u9009'; g.querySelector('.cgh .hint').textContent = '\u5DF2\u9009 ' + n + ' / ' + ins.length; g.classList.toggle('off', !n); }); }
function catCount() { grpLabels(); $('#catCount').textContent = '\u5DF2\u9009 ' + $$('#catBox input:checked').length + ' / ' + $$('#catBox input').length; }
function catAll(sel, on) { $$(sel + ' input').forEach((i) => (i.checked = on)); onEdit(); }
function catPreset() { $$('#catBox input').forEach((i) => (i.checked = REC.includes(i.value))); onEdit(); }

let STATUS = { initialized: true, storage: 'd1', env_token: false };
function showGate() {
  $('#gate').style.display = 'flex';
  $('#loginBox').style.display = STATUS.initialized ? '' : 'none';
  $('#setupBox').style.display = STATUS.initialized ? 'none' : '';
  (STATUS.initialized ? $('#tokenInput') : $('#pw1')).focus();
}
async function setup() {
  const a = $('#pw1').value, b = $('#pw2').value;
  if (a.length < 8) return toast('\u5BC6\u7801\u81F3\u5C11 8 \u4F4D', 3000, 'err');
  if (a !== b) return toast('\u4E24\u6B21\u8F93\u5165\u4E0D\u4E00\u81F4', 3000, 'err');
  const r = await fetch('/api/admin/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: a }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return toast(j.error || '\u8BBE\u7F6E\u5931\u8D25', 4000, 'err');
  STATUS.initialized = true;
  TOKEN = a; localStorage.setItem('frr_token', TOKEN);
  $('#gate').style.display = 'none';
  toast('\u5BC6\u7801\u5DF2\u8BBE\u7F6E', 2500, 'ok');
  init();
}
function setSitePw(btn, on) {
  return busy(btn, async () => {
    const pw = on ? $('#sitePw').value.trim() : '';
    if (on && pw.length < 4) throw new Error('\u8BBF\u95EE\u5BC6\u7801\u81F3\u5C11 4 \u4F4D');
    await api('/api/admin/site-password', { method: 'POST', body: JSON.stringify({ password: pw }) });
    $('#sitePw').value = '';
    STATUS.site_locked = on; siteLockLabel();
    toast(on ? '\u5DF2\u8BBE\u7F6E\u8BBF\u95EE\u5BC6\u7801' : '\u8D44\u6E90\u9875\u5DF2\u516C\u5F00', 2500, 'ok');
  });
}
function siteLockLabel() { const el = $('#siteLockState'); el.textContent = STATUS.site_locked ? '\u5DF2\u5F00\u542F' : '\u516C\u5F00'; el.className = 'tag ' + (STATUS.site_locked ? 'on' : 'off'); }
function changePw(btn) {
  return busy(btn, async () => {
    const pw = $('#newPw').value;
    await api('/api/admin/password', { method: 'POST', body: JSON.stringify({ password: pw }) });
    TOKEN = pw; localStorage.setItem('frr_token', TOKEN); $('#newPw').value = '';
    toast('\u5BC6\u7801\u5DF2\u4FEE\u6539', 2500, 'ok');
  });
}
function login() { TOKEN = $('#tokenInput').value.trim(); localStorage.setItem('frr_token', TOKEN); $('#gate').style.display = 'none'; init(); }
function logout() { localStorage.removeItem('frr_token'); TOKEN = ''; drawer(false); showGate(); }

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + TOKEN } });
  const j = await r.json().catch(() => ({ error: '\u54CD\u5E94\u4E0D\u662F JSON\uFF08HTTP ' + r.status + '\uFF09' }));
  if (r.status === 401) { showGate(); throw new Error('\u5BC6\u7801\u9519\u8BEF\u6216\u5DF2\u5931\u6548'); }
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}
// \u6309\u94AE\u70B9\u51FB\u7ACB\u5373\u7ED9\u53CD\u9988\uFF1A\u8F6C\u5708 + \u7981\u7528\uFF0C\u7ED3\u675F\u540E\u6062\u590D
async function busy(btn, fn) {
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }
  try { return await fn(); } catch (e) { toast('\u51FA\u9519\uFF1A' + e.message, 7000, 'err'); } finally { if (btn) { btn.disabled = false; btn.classList.remove('loading'); } }
}

// ---- \u8DEF\u7531 ----
function route() {
  let p = (location.hash || '#items').slice(1);
  p = ALIAS[p] || p;
  const key = TITLES[p] ? p : 'items';
  $$('.panel').forEach((el) => el.classList.toggle('on', el.id === 'p-' + key));
  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.p === key));
  $('#title').textContent = TITLES[key];
  drawer(false);
  if (key === 'runs' && TOKEN) loadRuns();
  if (key === 'collect' && TOKEN) { loadCronKey(); loadHealth(); }
  window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', route);

// ---- \u8BBE\u7F6E + \u672A\u4FDD\u5B58\u63D0\u9192 ----
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
  renderRcpt();
  renderSources();
  SNAP = collect();
  onEdit();
}
function collect() {
  const out = {};
  $$('[data-key]').forEach((el) => {
    const sh = el.closest('[data-show]');
    if (sh && sh.style.display === 'none' && out[el.dataset.key] !== undefined) return; // \u540C\u540D\u5B57\u6BB5\u53EA\u53D6\u663E\u793A\u7684\u90A3\u4E2A
    out[el.dataset.key] = el.type === 'checkbox' ? String(el.checked) : el.value;
  });
  $$('[data-csv]').forEach((box) => { out[box.dataset.csv] = [...box.querySelectorAll('input:checked')].map((i) => i.value).join(','); });
  return out;
}
function changedKeys() { const cur = collect(); return Object.keys(cur).filter((k) => cur[k] !== SNAP[k]); }
// ---- \u5206\u7C7B\u9009\u62E9\uFF08\u6570\u636E\u6E90\u3001\u641C\u7D22\u540E\u7AEF\u5171\u7528\uFF09 ----
const enabledNow = () => [...$$('#catBox input:checked')].map((i) => i.value);
function catSummary(list) {
  const en = enabledNow();
  if (!list.length) return '\u5168\u90E8\u5DF2\u52FE\u9009\u5206\u7C7B';
  const l = list.filter((k) => CAT[k]);
  const off = l.filter((k) => !en.includes(k)).length;
  return l.map((k) => CAT[k]).join('\u3001') + (off ? '\uFF08' + off + ' \u4E2A\u672A\u52FE\u9009\uFF09' : '');
}
function catPills(sel, onChange) {
  const box = document.createElement('div');
  box.className = 'cpills';
  const en = enabledNow();
  const draw = () => {
    box.innerHTML = '<button type="button" class="all' + (sel.length ? '' : ' on') + '" style="--cc:var(--accent)"><i></i>\u5168\u90E8\uFF08\u8DDF\u968F\u52FE\u9009\uFF09</button>' +
      CATS.filter((c) => c.key !== 'other').map((c) => '<button type="button" data-k="' + c.key + '" class="' + (sel.includes(c.key) ? 'on' : '') + (en.includes(c.key) ? '' : ' dis') + '" style="--cc:' + c.color + '" title="' + (en.includes(c.key) ? '' : '\u8FD9\u4E2A\u5206\u7C7B\u5728\u300C\u5206\u7C7B\u8BA2\u9605\u300D\u91CC\u6CA1\u52FE\u9009\uFF0C\u4E0D\u4F1A\u751F\u6548') + '"><i></i>' + esc(c.label) + '</button>').join('');
  };
  box.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('all')) sel = [];
    else { const k = b.dataset.k; sel = sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]; }
    draw(); onChange(sel);
  };
  draw();
  return box;
}

// ---- \u6570\u636E\u6E90\u7BA1\u7406\uFF08\u4EE5 JSON \u6587\u672C\u6846\u4E3A\u51C6\uFF0C\u8868\u683C\u662F\u5B83\u7684\u53EF\u89C6\u5316\u7F16\u8F91\uFF09 ----
let SRC_OPEN = -1;
function srcList() { try { const l = JSON.parse(field('sources').value); return Array.isArray(l) ? l : []; } catch { return null; } }
function setSrc(list) { field('sources').value = JSON.stringify(list, null, 2); onEdit(); renderSources(); }
const TYPE_ZH = { rss: 'RSS', telegram: 'TG', v2ex: 'V2EX', hn: 'HN', reddit: 'Reddit', github: 'GitHub \u641C\u7D22', repo: 'GitHub \u4ED3\u5E93', epic: 'Epic', gamerpower: 'GamerPower', openrouter_free: 'OpenRouter' };
function srcWhere(x) { if (x.url) { try { const u = new URL(x.url); return u.hostname.replace(/^www\\./, '') + (u.pathname.length > 1 ? u.pathname : ''); } catch { return x.url; } } return x.repo ? x.repo + (x.mode === 'sub' ? ' \xB7 \u8282\u70B9\u8BA2\u9605' : ' \xB7 \u540C\u6B65\u65B0\u589E') : x.channel ? '@' + x.channel : x.node ? 'node/' + x.node : x.query || ''; }
function renderSources() {
  const list = srcList(), box = $('#srcList');
  if (!list) { box.innerHTML = '<div class="empty" style="padding:18px">JSON \u683C\u5F0F\u6709\u8BEF\uFF0C\u5C55\u5F00\u4E0B\u65B9\u300C\u4EE5 JSON \u7F16\u8F91\u300D\u4FEE\u6B63</div>'; return; }
  const q = $('#srcQ').value.trim().toLowerCase(), f = $('#srcF').value;
  const en = enabledNow();
  box.innerHTML = '';
  list.forEach((x, i) => {
    const on = x.enabled !== false, cats = Array.isArray(x.cats) ? x.cats : x.cats ? String(x.cats).split(',') : [];
    if (q && !(String(x.name) + ' ' + srcWhere(x)).toLowerCase().includes(q)) return;
    if ((f === 'on' && !on) || (f === 'off' && on) || (f === 'limited' && !cats.length && !x.category) || (f === 'bad' && !healthOf(x)?.bad)) return;
    const row = document.createElement('div');
    row.className = 'srow' + (on ? '' : ' off');
    const fixed = x.category && x.category !== 'auto';
    const chips = fixed ? '<span class="tag c" style="--cc:' + (CATS.find((c) => c.key === x.category)?.color || '#888') + '">\u56FA\u5B9A\uFF1A' + esc(CAT[x.category] || x.category) + '</span>'
      : cats.length ? cats.map((k) => { const c = CATS.find((y) => y.key === k); return c ? '<span class="tag c" style="--cc:' + c.color + (en.includes(k) ? '' : ';opacity:.45') + '">' + esc(c.label) + '</span>' : ''; }).join('')
      : '<span class="tag">\u5168\u90E8\u5206\u7C7B</span>';
    row.innerHTML = '<label class="sw"><input type="checkbox"' + (on ? ' checked' : '') + ' /></label>' +
      '<div class="snm">' + esc(x.name || '\u672A\u547D\u540D') + '<span class="tag">' + (TYPE_ZH[x.type || 'rss'] || x.type) + '</span>' + (x.trusted ? '<span class="tag free">\u514D\u5BA1</span>' : '') + (x.include ? '<span class="tag" title="\u6807\u9898\u9700\u5339\u914D\uFF1A' + esc(x.include) + '">\u6709\u6807\u9898\u7B5B\u9009</span>' : '') + '<small>' + esc(srcWhere(x)) + (x.every ? ' \xB7 \u6BCF ' + x.every + ' \u5C0F\u65F6' : '') + '</small>' + healthHtml(x) + '</div>' +
      '<div class="scats" title="\u70B9\u51FB\u8BBE\u7F6E\u5206\u7C7B">' + chips + (x.hint && !fixed ? '<span class="tag" title="\u9ED8\u8BA4\u5206\u7C7B">\u9ED8\u8BA4 ' + esc(CAT[x.hint] || x.hint) + '</span>' : '') + '</div>' +
      '<button class="sdel" title="\u5220\u9664">\xD7</button>';
    row.querySelector('input').onchange = (e) => { const l = srcList(); l[i].enabled = e.target.checked; setSrc(l); };
    row.querySelector('.sdel').onclick = () => { if (confirm('\u5220\u9664\u300C' + (x.name || '') + '\u300D\uFF1F')) { const l = srcList(); l.splice(i, 1); SRC_OPEN = -1; setSrc(l); } };
    row.querySelector('.scats').onclick = () => { SRC_OPEN = SRC_OPEN === i ? -1 : i; renderSources(); };
    if (SRC_OPEN === i) {
      const ed = document.createElement('div');
      ed.className = 'sedit';
      ed.innerHTML = '<div><label class="f">' + (fixed ? '\u8FD9\u4E2A\u6E90\u56FA\u5B9A\u5F52\u5230\u300C' + esc(CAT[x.category] || x.category) + '\u300D\uFF0C\u514D AI \u5BA1\u6838\uFF1B\u4E5F\u53EF\u4EE5\u6539\u6210\u9650\u5B9A\u5206\u7C7B\u540E\u7167\u5E38\u5224\u5B9A' : '\u53EA\u6536\u8FD9\u4E9B\u5206\u7C7B') + '</label></div>' +
        '<div class="row2"><div><label class="f">\u9ED8\u8BA4\u5206\u7C7B\uFF08\u5F52\u4E0D\u4E86\u7C7B\u65F6\uFF09</label><select class="hint-s"><option value="">\u4E0D\u8BBE\u7F6E</option>' + CATS.filter((c) => c.key !== 'other').map((c) => '<option value="' + c.key + '"' + (x.hint === c.key ? ' selected' : '') + '>' + esc(c.label) + '</option>').join('') + '</select></div>' +
        '<div><label class="f">\u6807\u9898\u5FC5\u987B\u5305\u542B\uFF08\u6B63\u5219\uFF0C\u7559\u7A7A\u4E0D\u9650\uFF09</label><input type="text" class="inc-s" value="' + esc(x.include || '') + '" placeholder="\u4F8B\u5982 \u514D\u8D39|\u9650\u514D|\u767D\u5AD6" /></div></div>' +
        (fixed ? '<div><button class="btn sm unfix">\u6539\u4E3A\u9650\u5B9A\u5206\u7C7B\uFF08\u9001\u5224\u5B9A\uFF09</button></div>' : '');
      ed.children[0].appendChild(catPills(fixed ? [x.category] : cats, (sel) => { const l = srcList(); if (sel.length) l[i].cats = sel; else delete l[i].cats; if (fixed) { delete l[i].category; delete l[i].trusted; } setSrc(l); }));
      ed.querySelector('.hint-s').onchange = (e) => { const l = srcList(); if (e.target.value) l[i].hint = e.target.value; else delete l[i].hint; setSrc(l); };
      ed.querySelector('.inc-s').onchange = (e) => { const v = e.target.value.trim(); try { if (v) new RegExp(v); } catch { toast('\u6B63\u5219\u683C\u5F0F\u4E0D\u5BF9', 2500, 'err'); return; } const l = srcList(); if (v) l[i].include = v; else delete l[i].include; setSrc(l); };
      ed.querySelector('.unfix')?.addEventListener('click', () => { const l = srcList(); l[i].cats = [x.category]; l[i].hint = x.category; delete l[i].category; delete l[i].trusted; setSrc(l); });
      row.appendChild(ed);
    }
    box.appendChild(row);
  });
  if (!box.children.length) box.innerHTML = '<div class="empty" style="padding:18px">\u6CA1\u6709\u5339\u914D\u7684\u6E90</div>';
  const nBad = list.filter((x) => healthOf(x)?.bad).length;
  $('#offBad').style.display = nBad ? '' : 'none';
  $('#offBad').textContent = '\u505C\u7528\u6709\u95EE\u9898\u7684\u6E90\uFF08' + nBad + '\uFF09';
}
// ---- \u6765\u6E90\u5065\u5EB7 ----
let HEALTH = {};
async function loadHealth() { HEALTH = await api('/api/admin/sources/health').catch(() => ({})); renderSources(); }
function healthOf(x) {
  const h = HEALTH[x.name];
  if (!h) return null;
  const bad = x.enabled !== false && (h.errors >= 3 || (h.fetched === 0 && h.errors > 0));
  return { ...h, bad };
}
function healthHtml(x) {
  const h = healthOf(x);
  if (!h) return '';
  const t = '\u8FD1 7 \u5929\uFF1A\u6293\u5230 ' + h.fetched + ' \xB7 \u65B0\u589E ' + h.added + (h.errors ? ' \xB7 \u5931\u8D25 ' + h.errors + ' \u6B21' : '') + (h.last_at ? ' \xB7 \u6700\u8FD1\u6210\u529F ' + ago(h.last_at) : ' \xB7 \u4E00\u76F4\u6CA1\u6210\u529F');
  return '<span class="shealth' + (h.bad ? ' bad' : '') + '" title="' + esc(h.last_err ? '\u6700\u8FD1\u7684\u9519\u8BEF\uFF1A' + h.last_err : t) + '">' + (h.bad ? '\u26A0 ' : '') + esc(t) + '</span>';
}
function disableBad() {
  const l = srcList(); if (!l) return;
  const bad = l.filter((x) => healthOf(x)?.bad);
  if (!bad.length) return toast('\u6CA1\u6709\u6709\u95EE\u9898\u7684\u6E90', 2000);
  if (!confirm('\u505C\u7528\u8FD9 ' + bad.length + ' \u4E2A\u6E90\uFF1F\\n' + bad.map((x) => x.name).join('\\n'))) return;
  for (const x of bad) x.enabled = false;
  setSrc(l); toast('\u5DF2\u505C\u7528 ' + bad.length + ' \u4E2A\uFF0C\u8BB0\u5F97\u4FDD\u5B58', 3000, 'ok');
}

// ---- Webhook \u63A8\u9001\u6E20\u9053 ----
function renderPush() {
  $('#pushRows').innerHTML = PUSH.map((c) => '<div class="pushrow"><div class="nm">' + esc(c.name) + '<label class="sw"><input type="checkbox" data-key="' + c.id + '_enabled" />\u542F\u7528</label></div>' +
    '<div class="in"><input type="password" data-key="' + c.key + '" autocomplete="off" placeholder="' + esc(c.id === 'bark' ? 'https://api.day.app/\u4F60\u7684Key' : c.id === 'serverchan' ? 'SendKey' : c.id === 'pushplus' ? 'token' : 'Webhook \u5730\u5740') + '" />' +
    (c.secret ? '<input type="password" data-key="' + c.secret + '" autocomplete="off" placeholder="\u52A0\u7B7E\u5BC6\u94A5\uFF08\u53EF\u9009\uFF09" />' : '') + '<span class="hint">' + esc(c.hint) + '</span></div>' +
    '<button class="btn sm" onclick="pushAction(\\'test\\', \\'push:' + c.id + '\\', this)">\u6D4B\u8BD5</button></div>').join('');
}
function weeklyAction(btn) {
  return busy(btn, async () => {
    const r = await api('/api/admin/weekly/send', { method: 'POST', body: JSON.stringify({ test: false }) });
    toast(r.skipped ? '\u672A\u53D1\u9001\uFF1A' + r.skipped : '\u5DF2\u63A8\u9001\u672C\u5468\u7CBE\u9009 ' + r.sent + ' \u6761\uFF08' + r.providers.join(' + ') + '\uFF09' + (r.errors && r.errors.length ? '\uFF1B\u5931\u8D25\uFF1A' + r.errors.join('\uFF1B') : ''), 7000, r.skipped ? '' : 'ok');
  });
}

// ---- \u5907\u4EFD\u4E0E\u8FC1\u79FB ----
function exportCfg(btn, secrets) {
  if (secrets && !confirm('\u5BFC\u51FA\u7684\u6587\u4EF6\u91CC\u4F1A\u5305\u542B AI Key\u3001\u90AE\u7BB1\u6388\u6743\u7801\u7B49\u5BC6\u94A5\uFF0C\u786E\u5B9A\u5BFC\u51FA\uFF1F')) return;
  return busy(btn, async () => {
    const r = await fetch('/api/admin/export' + (secrets ? '?secrets=1' : ''), { headers: { authorization: 'Bearer ' + TOKEN } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await r.blob());
    a.download = 'free-resource-radar-' + new Date().toISOString().slice(0, 10) + (secrets ? '-\u542B\u5BC6\u94A5' : '') + '.json';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
}
async function importCfg(input) {
  const f = input.files[0]; input.value = '';
  if (!f) return;
  let j;
  try { j = JSON.parse(await f.text()); } catch { return toast('\u6587\u4EF6\u4E0D\u662F\u6709\u6548\u7684 JSON', 4000, 'err'); }
  if (!confirm('\u5BFC\u5165\u540E\u4F1A\u8986\u76D6\u5907\u4EFD\u91CC\u5305\u542B\u7684 ' + Object.keys(j.settings || {}).length + ' \u9879\u8BBE\u7F6E\uFF08\u5305\u62EC\u6570\u636E\u6E90\uFF09\uFF0C\u786E\u5B9A\uFF1F')) return;
  await busy(null, async () => { const r = await api('/api/admin/import', { method: 'POST', body: JSON.stringify(j) }); fill(r.settings); toast('\u5DF2\u5BFC\u5165 ' + r.count + ' \u9879\u8BBE\u7F6E', 3000, 'ok'); });
}

function addSource() {
  const url = prompt('RSS \u5730\u5740\uFF0C\u6216 Telegram \u9891\u9053\uFF08@\u9891\u9053\u540D\uFF09\uFF1A');
  if (!url) return;
  const l = srcList() || [];
  const tg = /^@?\\w{4,}$/.test(url.trim()) || /t\\.me\\/(s\\/)?(\\w+)/.exec(url);
  if (tg) { const ch = (typeof tg === 'object' && tg[2]) || url.trim().replace(/^@/, ''); l.unshift({ name: 'TG \xB7 @' + ch, type: 'telegram', channel: ch, enabled: true }); }
  else if (/^https?:\\/\\//.test(url.trim())) { let h = url; try { h = new URL(url).hostname.replace(/^www\\./, ''); } catch {} l.unshift({ name: h, type: 'rss', url: url.trim(), enabled: true }); }
  else return toast('\u4E0D\u662F\u6709\u6548\u7684\u5730\u5740', 2500, 'err');
  SRC_OPEN = 0; $('#srcQ').value = ''; $('#srcF').value = '';
  setSrc(l);
  toast('\u5DF2\u6DFB\u52A0\uFF0C\u53EF\u4EE5\u6539\u540D\u79F0\u548C\u5206\u7C7B\uFF0C\u8BB0\u5F97\u4FDD\u5B58', 3000, 'ok');
}
let SYNC = null;
function renderSync(r) {
  SYNC = r;
  const n = r.groups.reduce((a, g) => a + g.items.length, 0);
  const fresh = r.groups.reduce((a, g) => a + g.items.filter((x) => x.why !== '\u5DF2\u6709').length, 0);
  $('#syncSum').textContent = n ? '\u627E\u5230 ' + fresh + ' \u4E2A\u65B0\u6E90' + (r.existing ? '\uFF0C' + r.existing + ' \u4E2A\u5DF2\u6709' : '') + (r.unsupported ? '\uFF0C' + r.unsupported + ' \u4E2A\u7C7B\u578B\u6682\u4E0D\u652F\u6301' : '') : '';
  $('#syncErr').textContent = (r.errors || []).length ? r.errors.join('\uFF1B') : '';
  $('#syncBody').innerHTML = n ? r.groups.map((g, gi) => '<h4>' + esc(g.label) + ' \xB7 ' + g.items.length + ' \u4E2A</h4>' + g.items.map((it, ii) =>
    '<label class="sitem"><input type="checkbox" data-g="' + gi + '" data-i="' + ii + '"' + (it.suggest ? ' checked' : '') + (it.why === '\u5DF2\u6709' ? ' disabled' : '') + ' /><div class="snm">' + esc(it.src.name) + '<span class="tag">' + (TYPE_ZH[it.src.type || 'rss'] || it.src.type) + '</span>' + (it.why ? '<span class="tag why">' + esc(it.why) + '</span>' : '<span class="tag on">\u63A8\u8350</span>') + (it.src.hint ? '<span class="tag">' + esc(CAT[it.src.hint] || it.src.hint) + '</span>' : '') + (it.facts ? '<span class="tag">' + esc(it.facts) + '</span>' : '') + '<small>' + esc(srcWhere(it.src)) + '</small>' + (it.sample ? '<span class="smp">' + esc(it.sample) + '</span>' : '') + '</div></label>').join('')).join('')
    : '<div class="empty" style="padding:30px 0">' + (SYNC_MODE === 'sync' ? '\u5DF2\u7ECF\u662F\u6700\u65B0\u7684\u4E86\uFF0C\u6CA1\u6709\u65B0\u7684\u6E90\u3002' : '\u6CA1\u6709\u627E\u5230\u53EF\u7528\u7684\u8BA2\u9605\u6E90\u3002') + '</div>';
  syncCount();
}
let SYNC_MODE = 'sync';
function syncOpen(mode, title, top) {
  SYNC_MODE = mode; SYNC = { groups: [] };
  $('#syncTitle').textContent = title;
  $('#syncTop').innerHTML = top || '';
  $('#syncSum').textContent = ''; $('#syncErr').textContent = '';
  $('#syncBody').innerHTML = mode === 'sync' ? '' : '<div class="empty" style="padding:24px 0">' + (mode === 'batch' ? '\u6BCF\u884C\u4E00\u4E2A\uFF1A\u7F51\u7AD9\u9996\u9875\u3001RSS \u5730\u5740\u3001t.me/\u9891\u9053 \u6216 @\u9891\u9053\uFF0C\u4E5F\u53EF\u4EE5\u8D34 JSON \u6E90\u3002\u7F51\u9875\u4F1A\u81EA\u52A8\u627E\u8BA2\u9605\u5730\u5740\u3002' : '\u8F93\u5165\u4F60\u60F3\u8BA2\u9605\u7684\u5185\u5BB9\uFF0C\u6BD4\u5982\u300C\u514D\u8D39 VPS\u300D\u300CAI \u989D\u5EA6\u300D\uFF0C\u4F1A\u7528\u5DF2\u5F00\u542F\u7684\u641C\u7D22\u540E\u7AEF\u627E\u76F8\u5173\u7F51\u7AD9\u5E76\u68C0\u6D4B\u8BA2\u9605\u5730\u5740\u3002') + '</div>';
  syncCount();
  $('#syncModal').classList.add('on');
}
async function openSync(btn) {
  await busy(btn, async () => {
    const r = await api('/api/admin/sources/check', { method: 'POST', body: JSON.stringify({ sources: field('sources').value, urls: field('source_sync_urls').value }) });
    syncOpen('sync', '\u66F4\u65B0\u6E90');
    renderSync(r);
  });
}
function openBatch(prefill, auto) {
  syncOpen('batch', '\u6279\u91CF\u6DFB\u52A0', '<textarea id="batchIn" placeholder="https://www.example.com/\\nhttps://example.com/feed\\nt.me/abskoop\\n@zaihuapd\\ngithub.com/owner/repo"></textarea><div class="row"><span class="hint">\u4E00\u6B21\u6700\u591A 15 \u4E2A\uFF0C\u4F1A\u9010\u4E2A\u68C0\u6D4B\u80FD\u4E0D\u80FD\u6293\u5230\u5185\u5BB9</span><span class="sp" style="flex:1"></span><button class="btn pri" id="batchGo" onclick="runBatch(this)">\u68C0\u6D4B</button></div>');
  if (prefill) $('#batchIn').value = prefill;
  setTimeout(() => (auto ? runBatch($('#batchGo')) : $('#batchIn').focus()), 0);
}
async function runBatch(btn) {
  const lines = $('#batchIn').value.trim();
  if (!lines) return toast('\u5148\u7C98\u8D34\u7F51\u5740', 2000, 'err');
  await busy(btn, async () => renderSync(await api('/api/admin/sources/probe', { method: 'POST', body: JSON.stringify({ sources: field('sources').value, lines }) })));
}
function openDiscover(kw, auto) {
  const on = ((field('enabled_categories') || {}).value ?? SETTINGS.enabled_categories ?? '').split(',').filter(Boolean);
  const quick = (on.length ? on : CATS.map((c) => c.key)).slice(0, 10).map((k) => '<button class="qk" onclick="DISC_CAT=\\'' + k + '\\';$(\\'#discIn\\').value=this.textContent;runDiscover($(\\'#discGo\\'),1)">' + esc(CAT[k] ? '\u514D\u8D39' + CAT[k].replace(/^\u514D\u8D39/, '') : k) + '</button>').join('');
  syncOpen('discover', '\u53D1\u73B0\u65B0\u8BA2\u9605\u6E90', '<div class="row"><input id="discIn" placeholder="\u5173\u952E\u8BCD\uFF0C\u6BD4\u5982\uFF1A\u514D\u8D39 VPS\u3001AI \u989D\u5EA6\u3001\u9650\u514D\u6E38\u620F" onkeydown="if(event.key===\\'Enter\\')runDiscover($(\\'#discGo\\'))" /><button class="btn pri" id="discGo" onclick="runDiscover(this)">\u641C\u7D22</button></div><div class="row"><span class="hint">\u6309\u5DF2\u8BA2\u9605\u7684\u5206\u7C7B\uFF1A</span>' + quick + '</div>');
  if (kw) $('#discIn').value = kw;
  setTimeout(() => (auto && kw ? runDiscover($('#discGo')) : $('#discIn').focus()), 0);
}
let DISC_CAT = '';
async function runDiscover(btn, keepCat) {
  if (!keepCat) DISC_CAT = '';
  const keyword = $('#discIn').value.trim();
  if (!keyword) return toast('\u5148\u8F93\u5165\u5173\u952E\u8BCD', 2000, 'err');
  $('#syncBody').innerHTML = '<div class="empty" style="padding:24px 0">\u6B63\u5728\u641C\u7D22\u5E76\u68C0\u6D4B\u5404\u4E2A\u7F51\u7AD9\u7684\u8BA2\u9605\u5730\u5740\uFF0C\u5927\u7EA6 10\u201320 \u79D2\u2026</div>';
  await busy(btn, async () => renderSync(await api('/api/admin/sources/discover', { method: 'POST', body: JSON.stringify({ sources: field('sources').value, keyword }) })));
}
function syncCount() { const n = $$('#syncBody input:checked').length; $('#syncAdd').textContent = n ? '\u6DFB\u52A0\u9009\u4E2D ' + n + ' \u4E2A' : '\u6DFB\u52A0\u9009\u4E2D'; $('#syncAdd').disabled = !n; }
$('#syncBody').addEventListener('change', syncCount);
function syncAll(all) { $$('#syncBody input').forEach((i) => (i.checked = all || SYNC.groups[i.dataset.g].items[i.dataset.i].suggest)); syncCount(); }
function subSite(u) {
  let o = u; try { const x = new URL(u); o = x.hostname === 't.me' ? u : x.origin + '/'; } catch {}
  openBatch(o, true);
}
function closeSync() { $('#syncModal').classList.remove('on'); }
function applySync() {
  // \u4ECE\u5206\u7C7B\u5FEB\u6377\u8BCD\u53D1\u73B0\u7684\u6E90\uFF0C\u9ED8\u8BA4\u5206\u7C7B\u5C31\u8BBE\u6210\u90A3\u4E2A\u5206\u7C7B
  const add = [...$$('#syncBody input:checked')].map((i) => SYNC.groups[i.dataset.g].items[i.dataset.i].src).map((x) => (SYNC_MODE === 'discover' && DISC_CAT && !x.hint ? { ...x, hint: DISC_CAT } : x));
  const l = srcList() || [];
  setSrc([...l, ...add]);
  closeSync();
  // \u8DF3\u5230\u6570\u636E\u6E90\u5217\u8868\uFF0C\u65B0\u52A0\u7684\u95EA\u4E00\u4E0B\uFF0C\u65B9\u4FBF\u63A5\u7740\u8BBE\u5206\u7C7B
  if (location.hash !== '#collect') location.hash = 'collect';
  setTimeout(() => {
    const rows = [...$$('#srcList > *')];
    rows.slice(-add.length).forEach((r) => r.classList.add('srcnew'));
    $('#srcList').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
  toast('\u5DF2\u6DFB\u52A0 ' + add.length + ' \u4E2A\u6E90\uFF0C\u53EF\u4EE5\u5C55\u5F00\u8BBE\u7F6E\u5206\u7C7B\uFF0C\u4FDD\u5B58\u540E\u751F\u6548', 3500, 'ok');
}
function toggleBeCats(id) {
  const box = $('#be-' + id + ' .bce');
  if (box.style.display !== 'none') { box.style.display = 'none'; box.innerHTML = ''; return; }
  const v = field(id + '_cats').value;
  box.innerHTML = '';
  box.appendChild(catPills(v ? v.split(',') : [], (sel) => { field(id + '_cats').value = sel.join(','); onEdit(); }));
  box.style.display = '';
}
let srcT;
document.addEventListener('input', (e) => { if (e.target.id === 'srcJson') { clearTimeout(srcT); srcT = setTimeout(renderSources, 300); } });

// ---- \u6536\u4EF6\u4EBA ----
const EMAIL_RE = /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/;
const rcptList = () => field('mail_to').value.split(/[,;\uFF0C\uFF1B\\s]+/).map((x) => x.trim()).filter(Boolean);
function renderRcpt() {
  const box = $('#rcpt');
  box.querySelectorAll('.em').forEach((e) => e.remove());
  const inp = $('#rcptIn');
  rcptList().forEach((a, i) => {
    const el = document.createElement('span');
    el.className = 'em' + (EMAIL_RE.test(a) ? '' : ' bad');
    el.title = EMAIL_RE.test(a) ? a : '\u683C\u5F0F\u4E0D\u5BF9\uFF0C\u4E0D\u4F1A\u53D1\u9001';
    el.innerHTML = esc(a) + '<button type="button" aria-label="\u79FB\u9664">\xD7</button>';
    el.querySelector('button').onclick = (e) => { e.stopPropagation(); const l = rcptList(); l.splice(i, 1); setRcpt(l); };
    box.insertBefore(el, inp);
  });
  inp.placeholder = rcptList().length ? (rcptList().length >= 10 ? '\u6700\u591A 10 \u4E2A' : '\u7EE7\u7EED\u6DFB\u52A0') : '\u6DFB\u52A0\u90AE\u7BB1\uFF0C\u5982 me@qq.com';
}
function setRcpt(list) { field('mail_to').value = [...new Set(list)].slice(0, 10).join(','); renderRcpt(); onEdit(); }
function addRcpt(raw) {
  const add = String(raw).split(/[,;\uFF0C\uFF1B\\s]+/).map((x) => x.trim()).filter(Boolean);
  if (!add.length) return;
  const bad = add.filter((a) => !EMAIL_RE.test(a));
  if (bad.length) toast('\u90AE\u7BB1\u683C\u5F0F\u4E0D\u5BF9\uFF1A' + bad.join('\u3001'), 3500, 'err');
  setRcpt([...rcptList(), ...add.filter((a) => EMAIL_RE.test(a))]);
  $('#rcptIn').value = '';
}
$('#rcptIn').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',' || e.key === '\uFF0C' || e.key === ';' || e.key === ' ') { e.preventDefault(); addRcpt(e.target.value); }
  else if (e.key === 'Backspace' && !e.target.value) { const l = rcptList(); l.pop(); setRcpt(l); }
});
$('#rcptIn').addEventListener('blur', (e) => addRcpt(e.target.value));
$('#rcptIn').addEventListener('paste', (e) => { e.preventDefault(); addRcpt((e.clipboardData || window.clipboardData).getData('text')); });

// ---- \u65F6\u95F4\u8868\u9884\u89C8 ----
const hoursOf = (v) => [...new Set(String(v || '').split(/[,\uFF0C\\s]+/).map(Number).filter((h) => Number.isInteger(h) && h >= 0 && h <= 23))].sort((a, b) => a - b);
function schedText() {
  const every = Math.min(24, Math.max(1, Number(field('crawl_every_hours').value) || 24)), start = Number(field('run_hour').value) || 0;
  const hs = []; for (let k = 0; k * every < 24; k++) hs.push((start + k * every) % 24);
  hs.sort((a, b) => a - b);
  $('#crawlSched').innerHTML = '\u6BCF\u5929\u6293\u53D6 <b>' + hs.length + '</b> \u6B21\uFF1A' + hs.map((h) => '<b>' + h + ':00</b>').join('\u3001') + '\uFF08\u6BCF\u6B21\u7EA6 15\u201320 \u5206\u949F\u8DD1\u5B8C\uFF09';
  const mh = hoursOf(field('mail_hours').value);
  $('#mailSched').innerHTML = mh.length ? '\u6BCF\u5929\u63A8\u9001 <b>' + mh.length + '</b> \u6B21\uFF1A' + mh.map((h) => '<b>' + h + ':00</b>').join('\u3001') + '\u3002\u5982\u679C\u90A3\u65F6\u6B63\u5728\u6293\u53D6\uFF0C\u4F1A\u7B49\u6293\u5B8C\u518D\u53D1\uFF1B\u6BCF\u6B21\u53EA\u63A8\u4E0A\u6B21\u4E4B\u540E\u65B0\u901A\u8FC7\u7684\u3002' : '<span style="color:var(--alert)">\u6CA1\u6709\u586B\u63A8\u9001\u65F6\u95F4\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u63A8\u9001</span>';
  const cur = mh.join(',');
  $$('#mailHourPills button').forEach((b) => b.classList.toggle('on', b.dataset.v === cur));
}
$('#mailHourPills').innerHTML = [['9', '\u6BCF\u5929\u4E00\u6B21 9 \u70B9'], ['9,21', '\u65E9\u665A\u5404\u4E00\u6B21'], ['9,15,21', '\u4E00\u5929\u4E09\u6B21']].map(([v, l]) => '<button type="button" data-v="' + v + '">' + l + '</button>').join('');
$('#mailHourPills').onclick = (e) => { const b = e.target.closest('button'); if (b) { field('mail_hours').value = b.dataset.v; onEdit(); } };

function onEdit() {
  const ch = changedKeys();
  $('#rcpt').classList.toggle('changed', ch.includes('mail_to'));
  schedText();
  document.body.classList.toggle('dirty', ch.length > 0);
  $('#dirtyTxt').textContent = '\u6709 ' + ch.length + ' \u9879\u4FEE\u6539\u8FD8\u6CA1\u4FDD\u5B58';
  $$('[data-key]').forEach((el) => { const c = ch.includes(el.dataset.key); (el.type === 'checkbox' ? el.closest('label') : el).classList.toggle('changed', c); });
  $$('[data-csv]').forEach((box) => box.classList.toggle('changed', ch.includes(box.dataset.csv)));
  catCount();
  backendStates();
}
function revert() { fill(SETTINGS); toast('\u5DF2\u64A4\u9500\u4FEE\u6539', 2000); }
document.addEventListener('input', (e) => { if (e.target.closest('[data-key],[data-csv]')) onEdit(); });
document.addEventListener('change', (e) => { if (e.target.closest('[data-key],[data-csv]')) onEdit(); });
window.addEventListener('beforeunload', (e) => { if (document.body.classList.contains('dirty')) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save($('.top .save')); } });
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
    if (!data.enabled_categories) throw new Error('\u81F3\u5C11\u52FE\u9009\u4E00\u4E2A\u5206\u7C7B');
    if ($('#rcptIn').value.trim()) { addRcpt($('#rcptIn').value); Object.assign(data, collect()); }
    try { JSON.parse(data.sources); } catch (e) { location.hash = '#rules'; throw new Error('\u6570\u636E\u6E90 JSON \u683C\u5F0F\u9519\u8BEF\uFF1A' + e.message); }
    const n = changedKeys().length;
    const r = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) });
    fill(r.settings);
    toast(n ? '\u5DF2\u4FDD\u5B58 ' + n + ' \u9879\u4FEE\u6539' : '\u5DF2\u4FDD\u5B58', 2500, 'ok');
  });
}

function fetchModels(target, btn) {
  return busy(btn, async () => {
    const r = await api('/api/admin/models', { method: 'POST', body: JSON.stringify({ target, base_url: field(target + '_base_url').value, api_key: field(target + '_api_key').value }) });
    $('#' + target + '-models').innerHTML = r.models.map((m) => '<option value="' + esc(m) + '">').join('');
    const cur = field(target + '_model').value;
    $('#' + target + '-select').innerHTML = '<option value="">\u2014 \u5171 ' + r.models.length + ' \u4E2A\u6A21\u578B \u2014</option>' + r.models.map((m) => '<option' + (m === cur ? ' selected' : '') + ' value="' + esc(m) + '">' + esc(m) + '</option>').join('');
    toast('\u83B7\u53D6\u5230 ' + r.models.length + ' \u4E2A\u6A21\u578B', 3000, 'ok');
  });
}
function pick(target, v) { if (v) { field(target + '_model').value = v; onEdit(); } }
function testModel(target, btn) {
  return busy(btn, async () => {
    const body = { target, base_url: field(target + '_base_url').value, api_key: field(target + '_api_key').value, model: field(target + '_model').value };
    const r = await api('/api/admin/test', { method: 'POST', body: JSON.stringify(body) });
    toast('\u8FDE\u63A5\u6210\u529F\uFF08' + r.ms + 'ms\uFF09\uFF1A' + r.reply, 5000, 'ok');
  });
}
function testSearch(provider, btn) {
  return busy(btn, async () => {
    const out = $('#be-' + provider + ' .out');
    if (changedKeys().some((k) => k.startsWith(provider + '_'))) toast('\u6D4B\u8BD5\u7528\u7684\u662F\u5DF2\u4FDD\u5B58\u7684\u8BBE\u7F6E\uFF0C\u8BB0\u5F97\u5148\u4FDD\u5B58', 3500);
    const r = await api('/api/admin/search-test', { method: 'POST', body: JSON.stringify({ provider }) });
    out.style.display = 'block';
    out.textContent = '\u8FD4\u56DE ' + r.count + ' \u6761\uFF08' + r.ms + 'ms\uFF09\\n' + (r.errors || []).map((e) => '! ' + e + '\\n').join('') + r.sample.map((x) => '\xB7 ' + (x.date || '\u65E0\u65E5\u671F') + '  ' + x.title).join('\\n');
  });
}

// ---- \u89E6\u53D1\u5730\u5740 ----
async function loadCronKey() {
  try {
    const r = await api('/api/admin/cron-key');
    $('#cronUrl').value = location.origin + '/api/cron?key=' + r.key;
    $('#cronLast').textContent = r.last ? ' \u4E0A\u6B21\u88AB\u89E6\u53D1\uFF1A' + ago(r.last) + '\u3002' : '';
  } catch {}
}
function hitCron(btn) {
  return busy(btn, async () => {
    const r = await fetch($('#cronUrl').value).then((x) => x.json());
    if (r.error) throw new Error(r.error);
    const msg = r.throttled ? '\u95F4\u9694\u592A\u77ED\uFF0C' + r.retry_after + ' \u79D2\u540E\u518D\u8BD5' : r.action === 'step' || r.action === 'started' ? '\u5DF2\u63A8\u8FDB\u4E00\u6B65' + (r.current ? '\uFF1A' + r.current : '') + (r.left != null ? '\uFF0C\u5269 ' + r.left + ' \u6B65' : '') : (r.message || '\u6CA1\u6709\u8981\u6267\u884C\u7684');
    toast(msg, 4000, r.throttled ? '' : 'ok');
    loadCronKey();
  });
}
function resetCronKey(btn) {
  if (!confirm('\u6362\u65B0\u5BC6\u94A5\u540E\uFF0C\u65E7\u7684\u89E6\u53D1\u5730\u5740\u7ACB\u5373\u5931\u6548\u3002\u7EE7\u7EED\uFF1F')) return;
  return busy(btn, async () => { await api('/api/admin/cron-key', { method: 'POST' }); await loadCronKey(); toast('\u5DF2\u6362\u65B0\u5BC6\u94A5\uFF0C\u8BB0\u5F97\u66F4\u65B0\u5916\u90E8\u5B9A\u65F6\u670D\u52A1\u91CC\u7684\u5730\u5740', 4000, 'ok'); });
}

function runNow(btn) { return runSteps(btn, '/api/admin/run', '\u7ACB\u5373\u6293\u53D6', '\u6293\u53D6\u4E2D'); }
function rejudge(btn) {
  if (!confirm('\u628A\u4E4B\u524D\u7528\u5173\u952E\u8BCD\u5224\u5B9A\u8FC7\u7684\u6761\u76EE\u5168\u90E8\u4EA4\u7ED9 AI \u91CD\u65B0\u5224\u5B9A\uFF1F')) return;
  return runSteps(btn, '/api/admin/rejudge', btn.textContent, '\u5224\u5B9A\u4E2D');
}
function runSteps(btn, endpoint, label, doing) {
  return busy(btn, async () => {
    const plan = await api(endpoint, { method: 'POST' });
    if (location.hash !== '#items') location.hash = '#items';
    const box = $('#runBox'), out = $('#runOut'), prog = $('#runProg');
    box.style.display = 'block'; $('#runTitle').textContent = (plan.reset != null ? '\u5DF2\u91CD\u7F6E ' + plan.reset + ' \u6761\uFF0CAI \u5224\u5B9A\u4E2D' : doing) + '\u2026'; prog.style.width = '3%'; out.textContent = '\u51C6\u5907\u4E2D\u2026';
    const lines = [];
    let r;
    // \u9010\u6B65\u6267\u884C\uFF1A\u6BCF\u4E00\u6B65\u90FD\u662F\u4E00\u6B21\u72EC\u7ACB\u8BF7\u6C42\uFF0C\u4E0D\u4F1A\u89E6\u53D1\u514D\u8D39\u7248\u7684 CPU \u9650\u5236
    for (let i = 0; i < 300; i++) {
      r = await api('/api/admin/step', { method: 'POST', body: JSON.stringify({ n: 1 }) });
      if (r.idle) break;
      if (r.busy) { await new Promise((ok) => setTimeout(ok, 1500)); continue; } // \u5B9A\u65F6\u4EFB\u52A1\u6B63\u5728\u6267\u884C\u67D0\u4E00\u6B65\uFF0C\u7A0D\u7B49
      lines.push(...(r.log || []));
      const doneN = r.total - r.left;
      prog.style.width = Math.max(3, Math.round((doneN / r.total) * 100)) + '%';
      $('#runTitle').textContent = doing + ' ' + doneN + ' / ' + r.total + (r.current ? ' \xB7 ' + r.current : '');
      out.textContent = lines.slice(-200).join('\\n');
      out.scrollTop = out.scrollHeight;
      if (r.done) break;
    }
    if (!r || r.idle) { $('#runTitle').textContent = '\u6CA1\u6709\u53EF\u6267\u884C\u7684\u6B65\u9AA4'; toast(plan.existing ? '\u5DF2\u6709\u6293\u53D6\u5728\u8FDB\u884C\uFF0C\u5DF2\u63A5\u7740\u6267\u884C' : '\u6CA1\u6709\u53EF\u6267\u884C\u7684\u6B65\u9AA4'); return; }
    const s = r.stats;
    prog.style.width = '100%';
    $('#runTitle').textContent = plan.reset != null ? '\u5224\u5B9A\u5B8C\u6210\uFF1A\u901A\u8FC7 ' + s.approved : '\u6293\u53D6\u5B8C\u6210\uFF1A\u65B0\u589E ' + s.new + '\uFF0C\u901A\u8FC7 ' + s.approved;
    out.textContent = '\u6293\u5230 ' + s.fetched + ' \xB7 \u5019\u9009 ' + s.candidates + ' \xB7 \u65B0\u589E ' + s.new + '\uFF08\u4E13\u6E90\u76F4\u901A ' + (s.trusted || 0) + '\uFF09\xB7 \u5224\u5B9A ' + s.judged + '\uFF08\u81EA\u52A8\u5B9A ' + (s.auto || 0) + '\uFF0C\u7EC6\u5BA1 ' + Math.max(0, s.judged - (s.auto || 0) - (s.cached || 0)) + '\uFF0C\u590D\u7528 ' + (s.cached || 0) + '\uFF09\xB7 \u901A\u8FC7 ' + s.approved + ' \xB7 \u5408\u5E76 ' + (s.merged || 0) + ' \xB7 \u7591\u4F3C\u5931\u6548 ' + (s.dead || 0) + ' \xB7 \u5173\u952E\u8BCD\u63D0\u9192 ' + (s.watched || 0) + ' \xB7 \u9519\u8BEF ' + s.errors +
      '\\n\u8FC7\u6EE4\uFF1A\u8D85\u671F ' + s.too_old + ' \xB7 \u65E0\u65E5\u671F ' + s.undated + ' \xB7 \u975E\u4E2D\u6587 ' + (s.non_zh || 0) + ' \xB7 \u4E0D\u76F8\u5173 ' + s.off_topic + ' \xB7 \u566A\u97F3 ' + s.noise + ' \xB7 \u5C4F\u853D ' + (s.block_rule + s.blocked) + ' \xB7 \u91CD\u590D\u6807\u9898 ' + s.dup_title + '\\n\\n' + lines.join('\\n');
    toast($('#runTitle').textContent, 4000, 'ok');
    // \u5237\u65B0\u8D44\u6E90\u9875\u5FEB\u7167\uFF08\u5206\u51E0\u6B65\uFF0C\u6BCF\u6B65\u4E00\u6B21\u8BF7\u6C42\uFF0C\u514D\u5F97\u8D85\u51FA\u514D\u8D39\u7248 CPU \u9650\u5236\uFF09
    for (let i = 0; i < 30; i++) { const q = await api('/api/admin/snap', { method: 'POST', body: '{"force":' + (i === 0) + '}' }).catch(() => null); if (!q || q.done) break; }
    loadItems(CUR);
    if (Object.keys(HEALTH).length || location.hash === '#collect') loadHealth();
  });
}
function pushAction(kind, channel, btn) {
  return busy(btn, async () => {
    if (document.body.classList.contains('dirty')) toast('\u63A8\u9001\u7528\u7684\u662F\u5DF2\u4FDD\u5B58\u7684\u8BBE\u7F6E\uFF0C\u8BB0\u5F97\u5148\u4FDD\u5B58', 3500);
    const r = await api('/api/admin/mail/' + kind, { method: 'POST', body: JSON.stringify({ channel }) });
    toast(r.skipped ? '\u672A\u53D1\u9001\uFF1A' + r.skipped : '\u5DF2\u53D1\u9001 ' + r.sent + ' \u6761 \u2192 ' + r.to.join(', ') + (r.errors && r.errors.length ? '\uFF1B\u5931\u8D25\uFF1A' + r.errors.join('\uFF1B') : ''), 7000, r.skipped ? '' : 'ok');
  });
}
function mailPreview(btn) {
  return busy(btn, async () => {
    const w = window.open('', '_blank');
    const r = await fetch('/api/admin/mail/preview', { headers: { authorization: 'Bearer ' + TOKEN } });
    if (!r.ok) { w && w.close(); throw new Error('HTTP ' + r.status); }
    const url = URL.createObjectURL(new Blob([await r.text()], { type: 'text/html' }));
    if (w) w.location = url; else window.open(url, '_blank');
  });
}

// ---- \u8D44\u6E90 ----
async function loadItems(st) {
  CUR = st;
  $$('.tabs [data-st]').forEach((b) => b.classList.toggle('on', b.dataset.st === st));
  $('#items').style.opacity = '.5';
  const r = await api('/api/admin/items?status=' + st).finally(() => ($('#items').style.opacity = ''));
  if (CUR !== st) return;
  $$('.tabs [data-st]').forEach((b) => (b.querySelector('.n').textContent = r.counts[b.dataset.st] || 0));
  $('#navPending').textContent = r.counts.pending || '';
  $('#items').innerHTML = r.items.length ? r.items.map((it) => {
    const ob = (it.obtain ? '<span class="ob ' + (it.obtain === 'free' ? 'free' : 'cond') + '">' + OB[it.obtain] + '</span>' : '') +
      (it.dead ? ' <span class="tag bad">\u53EF\u80FD\u5931\u6548</span>' : '') + (it.expires_at ? ' <span class="tag ' + (it.expires_at < Date.now() ? 'bad' : 'warn') + '">\u622A\u6B62 ' + new Date(it.expires_at).toLocaleDateString('zh-CN') + '</span>' : '') +
      (it.up || it.down ? ' <span class="tag" title="\u8D44\u6E90\u9875\u4E0A\u7684 \u503C / \u4E0D\u503C \u6295\u7968">\u503C ' + (it.up || 0) + ' \xB7 \u4E0D\u503C ' + (it.down || 0) + '</span>' : '');
    return '<div class="item" id="it-' + it.id + '"><div class="score' + (it.score >= 70 ? ' hi' : '') + '">' + (it.score ?? '\u2014') + '</div><div>' +
      '<a class="t" href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.name || it.title) + '</a>' + ob +
      (it.summary ? '<div class="sum">' + esc(it.summary) + '</div>' : '') +
      '<div class="meta">' + [esc(it.source) + (() => { try { const l = JSON.parse(it.sources || '[]'); return l.length ? ' <span class="tag zh" title="' + esc(l.map((x) => x.n).join('\u3001')) + '">+' + l.length + ' \u4E2A\u6765\u6E90</span>' : ''; } catch { return ''; } })(), CAT[it.category] || '', it.signup ? '\u6CE8\u518C\uFF1A' + esc(it.signup) : '', ago(it.published_at), it.judged_by ? esc(it.judged_by) : ''].filter(Boolean).join('<i>\xB7</i>') + '</div>' +
      (it.name && it.name !== it.title ? '<div class="meta">' + esc(it.title) + '</div>' : '') +
      '</div><div class="acts">' +
      (st !== 'approved' ? '<button class="btn sm" onclick="setStatus(\\'' + it.id + '\\',\\'approved\\', this)">\u901A\u8FC7</button>' : '') +
      (st !== 'rejected' ? '<button class="btn sm" onclick="setStatus(\\'' + it.id + '\\',\\'rejected\\', this)">\u62D2\u7EDD</button>' : '') +
      (st !== 'pending' ? '<button class="btn sm" onclick="setStatus(\\'' + it.id + '\\',\\'pending\\', this)" title="\u4E0B\u6B21\u8FD0\u884C\u91CD\u65B0\u5224\u5B9A">\u91CD\u5224</button>' : '') +
      '<button class="btn sm" title="\u68C0\u6D4B\u8FD9\u4E2A\u7F51\u7AD9\u7684\u8BA2\u9605\u5730\u5740\u5E76\u52A0\u4E3A\u6570\u636E\u6E90" onclick="subSite(\\'' + esc(it.url) + '\\')">\u8BA2\u9605\u6B64\u7AD9</button>' +
      '<button class="btn sm danger" onclick="del(\\'' + it.id + '\\', this)">\u5220\u9664</button></div></div>';
  }).join('') : '<div class="empty">\u6682\u65E0</div>';
}
// \u64CD\u4F5C\u540E\u7ACB\u5373\u4ECE\u5217\u8868\u6DE1\u51FA\uFF0C\u4E0D\u7B49\u6574\u9875\u5237\u65B0
async function setStatus(id, status, btn) { await busy(btn, async () => { await api('/api/admin/items/' + id, { method: 'POST', body: JSON.stringify({ status }) }); $('#it-' + id)?.classList.add('gone'); toast({ approved: '\u5DF2\u901A\u8FC7', rejected: '\u5DF2\u62D2\u7EDD', pending: '\u5DF2\u653E\u56DE\u5F85\u5224\u5B9A' }[status], 1500, 'ok'); bumpCount(status); }); }
async function del(id, btn) { if (!confirm('\u5220\u9664\u8FD9\u6761\uFF1F')) return; await busy(btn, async () => { await api('/api/admin/items/' + id, { method: 'DELETE' }); $('#it-' + id)?.classList.add('gone'); bumpCount(null); }); }
function bumpCount(to) {
  const n = (st, d) => { const el = $('.tabs [data-st="' + st + '"] .n'); el.textContent = Math.max(0, (Number(el.textContent) || 0) + d); };
  n(CUR, -1); if (to) n(to, 1);
  $('#navPending').textContent = Number($('.tabs [data-st="pending"] .n').textContent) || '';
}
async function clearStatus() { if (!confirm('\u6E05\u7A7A\u5F53\u524D\u5206\u7C7B\u7684\u5168\u90E8\u6761\u76EE\uFF1F')) return; await busy(null, async () => { await api('/api/admin/items?status=' + CUR, { method: 'DELETE' }); loadItems(CUR); }); }

async function loadRuns() {
  const runs = await api('/api/admin/runs').catch(() => []);
  $('#runs').innerHTML = runs.length ? runs.map((r) => {
    const s = JSON.parse(r.stats || '{}');
    const line = (r.finished_at ? '' : '\u8FDB\u884C\u4E2D \xB7 ') + (r.trigger === 'mail' ? (r.log || '').split('\\n')[0] : '\u6293\u5230 ' + (s.fetched || 0) + ' \xB7 \u65B0\u589E ' + (s.new || 0) + ' \xB7 \u901A\u8FC7 ' + (s.approved || 0) + ' \xB7 \u9519\u8BEF ' + (s.errors || 0));
    const trig = { cron: '\u5B9A\u65F6', manual: '\u624B\u52A8', url: '\u89E6\u53D1\u5730\u5740', visit: '\u8BBF\u95EE\u89E6\u53D1', rejudge: '\u91CD\u65B0\u5224\u5B9A', mail: '\u63A8\u9001' }[r.trigger] || r.trigger;
    return '<details class="run"><summary>' + fmt(r.started_at) + '<span class="hint"> \xB7 ' + esc(trig) + ' \xB7 </span>' + esc(line) + '</summary><pre>' + esc((r.log || '') + '\\n\\n' + JSON.stringify(s, null, 2)) + '</pre></details>';
  }).join('') : '<div class="empty">\u8FD8\u6CA1\u6709\u8FD0\u884C\u8FC7</div>';
}

async function init() {
  if (!$('#catBox').children.length) { renderCats(); renderBackends(); renderPush(); }
  route();
  STATUS = await fetch('/api/admin/status').then((r) => r.json()).catch(() => STATUS);
  const where = STATUS.storage === 'kv' ? 'Cloudflare KV' : 'D1 \u72EC\u7ACB\u7684 secrets \u8868';
  $$('.storageNote').forEach((el) => (el.textContent = ' Key \u7B49\u654F\u611F\u4FE1\u606F\u4FDD\u5B58\u5728 ' + where + '\uFF0C\u540E\u53F0\u53EA\u663E\u793A\u6253\u7801\u503C\u3002'));
  $('#storageInfo').textContent = '\u8D44\u6E90\u4E0E\u8BBE\u7F6E\uFF1AD1 \u6570\u636E\u5E93\u3002\u654F\u611F\u4FE1\u606F\uFF1A' + where + (STATUS.storage === 'kv' ? '' : '\uFF08\u5982\u9700\u6539\u5B58 KV\uFF0C\u7ED9 Worker \u7ED1\u5B9A\u4E00\u4E2A\u53D8\u91CF\u540D\u4E3A SECRETS \u7684 KV \u547D\u540D\u7A7A\u95F4\uFF0C\u518D\u4FDD\u5B58\u4E00\u6B21\u8BBE\u7F6E\uFF09') + '\u3002';
  $('#pwEnvNote').style.display = STATUS.env_token ? '' : 'none';
  $('#pwForm').style.display = STATUS.env_token ? 'none' : '';
  siteLockLabel();
  if (!STATUS.initialized || !TOKEN) return showGate();
  // \u8BBE\u7F6E\u548C\u5217\u8868\u5E76\u884C\u52A0\u8F7D
  const [s] = await Promise.all([api('/api/admin/settings').catch((e) => { toast(e.message, 6000, 'err'); return null; }), loadItems(CUR).catch(() => {})]);
  if (s) fill(s);
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
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE \xB7 \u6BCF\u65E5\u767D\u5AD6\u60C5\u62A5</title>
<meta name="description" content="\u6BCF\u5929\u81EA\u52A8\u6536\u96C6\u514D\u8D39\u57DF\u540D\u3001\u4E3B\u673A\u3001\u4E91\u670D\u52A1\u3001AI \u989D\u5EA6\u3001\u9650\u514D\u8F6F\u4EF6\u4E0E\u6E38\u620F\u3001\u79D1\u6280\u8D44\u8BAF\u548C\u514D\u8D39\u8282\u70B9\u8BA2\u9605" />
<meta name="theme-color" content="#ffffff" />
<link rel="alternate" type="application/rss+xml" title="RSS" href="/feed.xml" />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%234f46e5'/><circle cx='16' cy='16' r='9' fill='none' stroke='%23fff' stroke-width='2' opacity='.5'/><circle cx='16' cy='16' r='4' fill='%23fff'/></svg>" />
<style>
  /* \u7248\u5F0F\u53C2\u8003\u4EC0\u4E48\u503C\u5F97\u4E70 / \u7EBF\u62A5\u9177\u8FD9\u7C7B\u7F8A\u6BDB\u7AD9\uFF08\u680F\u76EE\u9875\u7B7E + \u4FE1\u606F\u6D41\u5361\u7247 + \u53F3\u4FA7\u680F\uFF09\uFF0C\u914D\u8272\u6CBF\u7528\u539F\u6765\u7684\u975B\u84DD + \u6D45\u7070 */
  :root {
    --brand:#4f46e5; --brand-2:#4338ca; --brand-bg:#eef0ff; --brand-line:#c7cbfb; --deep:#312e81;
    --bg:#f6f7f9; --surface:#fff; --hover:#f9fafb; --line:#e6e8ec; --line-2:#d5d9e0;
    --ink:#111318; --ink-2:#374151; --ink-3:#5b6472; --ink-4:#8a93a1;
    --deal:#047857; --deal-bg:#e8f8f0; --cond:#92400e; --cond-bg:#fef3c7; --new:#dc2626; --alert:#b91c1c; --alert-bg:#fef2f2;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    --r:8px; --head:56px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --brand:#818cf8; --brand-2:#a5b4fc; --brand-bg:#1e1b4b; --brand-line:#3730a3; --deep:#c7d2fe;
      --bg:#0d0f13; --surface:#15181e; --hover:#1b1f26; --line:#252a33; --line-2:#333a45;
      --ink:#eef0f4; --ink-2:#cfd4dc; --ink-3:#9aa3b1; --ink-4:#6f7887;
      --deal:#34d399; --deal-bg:#0f2a20; --cond:#fbbf24; --cond-bg:#2a2210; --alert:#f87171; --alert-bg:#2a1414;
    }
  }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html { -webkit-text-size-adjust:100%; }
  body { margin:0; font:14px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",Roboto,sans-serif; color:var(--ink); background:var(--bg); -webkit-font-smoothing:antialiased; }
  a { color:inherit; text-decoration:none; }
  button { font:inherit; color:inherit; cursor:pointer; }
  :focus-visible { outline:2px solid var(--brand-line); outline-offset:2px; }
  .wrap { max-width:1200px; margin:0 auto; padding:0 16px; }

  /* ---------- \u9876\u90E8\u54C1\u724C\u6761 ---------- */
  .head { background:var(--surface); color:var(--ink); border-bottom:1px solid var(--line); position:sticky; top:0; z-index:20; }
  .head .wrap { height:var(--head); display:flex; align-items:center; gap:18px; }
  .logo { display:flex; align-items:center; gap:9px; font-weight:800; font-size:18px; letter-spacing:.02em; white-space:nowrap; }
  .logo i { width:30px; height:30px; border-radius:9px; background:linear-gradient(135deg,#6366f1,#3730a3); display:grid; place-items:center; flex:none; }
  .logo i::after { content:""; width:9px; height:9px; border-radius:50%; background:#fff; box-shadow:0 0 0 4px rgba(255,255,255,.25); }
  .logo small { font-weight:500; font-size:12px; color:var(--ink-4); margin-left:2px; }
  .search { flex:1; max-width:520px; position:relative; }
  .search input { width:100%; height:36px; border:1px solid var(--line); border-radius:18px; padding:0 72px 0 16px; font:inherit; font-size:13.5px; background:var(--bg); color:var(--ink); outline:none; transition:border-color .12s, background-color .12s; }
  .search input:focus { border-color:var(--brand-line); background:var(--surface); }
  .search button { position:absolute; right:3px; top:3px; height:30px; border:none; border-radius:15px; padding:0 16px; background:var(--brand); color:#fff; font-size:13px; font-weight:600; }
  .head .links { display:flex; gap:16px; font-size:13px; white-space:nowrap; }
  .head .links a { color:var(--ink-3); }
  .head .links a:hover { color:var(--brand); }

  /* ---------- \u680F\u76EE\u9875\u7B7E ---------- */
  .tabs { background:var(--surface); border-bottom:1px solid var(--line); position:sticky; top:var(--head); z-index:15; }
  .tabs .wrap { display:flex; gap:4px; overflow-x:auto; scrollbar-width:none; }
  .tabs .wrap::-webkit-scrollbar { display:none; }
  .tab { flex:none; border:none; background:none; padding:12px 13px 11px; font-size:14.5px; color:var(--ink-2); border-bottom:3px solid transparent; display:inline-flex; align-items:center; gap:6px; white-space:nowrap; }
  .tab:hover { color:var(--brand); }
  .tab.on { color:var(--brand); font-weight:700; border-bottom-color:var(--brand); }
  .tab .n { font:600 11px/17px var(--mono); color:var(--ink-4); background:var(--bg); border-radius:9px; padding:0 6px; }
  .tab .n:empty { display:none; }
  .tabs .sep { flex:none; width:1px; background:var(--line); margin:12px 6px; }
  .tab.on .n { color:var(--brand); background:var(--brand-bg); }

  /* ---------- \u4E3B\u4F53 ---------- */
  .main { display:grid; grid-template-columns:minmax(0,1fr) 290px; gap:16px; padding-top:14px; padding-bottom:80px; }
  .main > section, .aside { min-width:0; }
  .filters { background:var(--surface); border:1px solid var(--line); border-radius:var(--r); padding:10px 14px; display:flex; flex-direction:column; gap:8px; margin-bottom:12px; }
  .frow { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .frow > b { font-size:12.5px; color:var(--ink-4); font-weight:500; width:60px; flex:none; }
  .chip { border:1px solid transparent; background:none; border-radius:4px; padding:2px 10px; font-size:13px; color:var(--ink-2); display:inline-flex; align-items:center; gap:5px; }
  .chip:hover { color:var(--brand); }
  .chip.on { color:var(--brand); border-color:var(--brand-line); background:var(--brand-bg); font-weight:600; }
  .chip .d { width:7px; height:7px; border-radius:50%; }
  .chip .n { font:11px var(--mono); color:var(--ink-4); }

  .dayh { display:flex; align-items:center; gap:10px; margin:16px 2px 8px; font-size:13px; color:var(--ink-3); }
  .dayh b { color:var(--ink); font-size:14px; }
  .dayh::after { content:""; flex:1; height:1px; background:var(--line); }
  .feed { display:flex; flex-direction:column; gap:10px; }
  .item { background:var(--surface); border-radius:var(--r); padding:14px 16px; display:grid; grid-template-columns:62px minmax(0,1fr) auto; gap:14px; align-items:start; border:1px solid var(--line); transition:border-color .12s; }
  .item:hover { border-color:var(--line-2); }
  .item.read .t { color:var(--ink-3); font-weight:500; }
  .item.dead { opacity:.6; }
  .item.dead .t { text-decoration:line-through; text-decoration-color:var(--ink-4); }
  .badge { width:62px; height:62px; border-radius:8px; display:grid; place-items:center; color:#fff; font-weight:800; font-size:17px; letter-spacing:.02em; background:var(--c,#999); position:relative; overflow:hidden; text-align:center; line-height:1.15; padding:4px; }
  .badge::after { content:""; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,.18),transparent 60%); }
  .t { font-size:15.5px; font-weight:600; line-height:1.5; word-break:break-word; color:var(--ink); }
  a.t:hover { color:var(--brand); }
  .tags { display:inline-flex; gap:4px; margin-left:6px; vertical-align:2px; }
  .tg { font-size:11px; line-height:18px; border-radius:3px; padding:0 6px; white-space:nowrap; color:var(--cond); background:var(--cond-bg); font-weight:600; }
  .tg.free { color:var(--deal); background:var(--deal-bg); }
  .tg.new { color:#fff; background:var(--new); }
  .tg.soon { color:var(--alert); background:var(--alert-bg); }
  .tg.dead { color:var(--ink-3); background:var(--bg); }
  .tg.hot { color:var(--brand-2); background:var(--brand-bg); }
  .tg.old { color:var(--ink-3); background:var(--bg); }
  .sum { color:var(--ink-3); margin-top:4px; font-size:13.5px; line-height:1.65; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .meta { color:var(--ink-4); font-size:12.5px; margin-top:7px; display:flex; flex-wrap:wrap; align-items:center; gap:2px 12px; }
  .meta .cat { color:var(--c); font-weight:600; }
  .meta .host { font-family:var(--mono); font-size:11.5px; }
  .srcs { color:var(--brand-2); }
  .srcs a { text-decoration:underline dotted; text-underline-offset:2px; }
  .side { display:flex; flex-direction:column; align-items:flex-end; gap:8px; min-width:92px; }
  .time { font-size:12px; color:var(--ink-4); white-space:nowrap; }
  .go { background:var(--brand); color:#fff; border-radius:15px; padding:4px 14px; font-size:13px; font-weight:600; white-space:nowrap; border:none; }
  .how { margin-top:5px; font-size:13px; color:var(--ink-2); }
  .how b { color:var(--ink-4); font-weight:500; }
  .codes { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
  .code { display:inline-flex; align-items:center; gap:6px; border:1px dashed var(--brand-line); background:var(--brand-bg); color:var(--deep); border-radius:6px; padding:1px 4px 1px 8px; font:600 12.5px var(--mono); }
  .code button { border:none; background:var(--surface); border-radius:4px; font-size:11px; padding:0 6px; color:var(--brand-2); }
  .acts { display:flex; gap:6px; align-items:center; }
  .vb { border:1px solid var(--line); background:var(--surface); border-radius:13px; font-size:12px; padding:1px 9px; color:var(--ink-3); display:inline-flex; gap:4px; align-items:center; }
  .vb:hover { border-color:var(--brand-line); color:var(--brand); }
  .vb.on { border-color:var(--brand); color:var(--brand); background:var(--brand-bg); font-weight:600; }
  .vb.no.on { border-color:var(--ink-4); color:var(--ink-2); background:var(--bg); }
  .star { border:none; background:none; font-size:17px; line-height:1; color:var(--ink-4); padding:0 2px; }
  .star.on { color:#f59e0b; }
  .vhead { background:var(--surface); border:1px solid var(--line); border-radius:var(--r); padding:12px 16px; margin-bottom:12px; font-size:13px; color:var(--ink-3); display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .vhead b { color:var(--ink); font-size:15px; }
  .vhead .sp { flex:1; }
  .rankn { position:absolute; left:6px; top:4px; font:800 12px var(--mono); color:#fff; opacity:.9; z-index:1; }
  .ck { display:grid; grid-template-columns:24px minmax(0,1fr) auto; gap:10px; align-items:center; background:var(--surface); border:1px solid var(--line); border-radius:var(--r); padding:11px 14px; }
  .ck input { width:18px; height:18px; accent-color:var(--brand); margin:0; }
  .ck.done { opacity:.6; }
  .ck.done .nm { text-decoration:line-through; }
  .ck .nm { font-weight:600; font-size:14.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; }
  .ck small { color:var(--ink-4); font-size:12.5px; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ckbar { height:6px; border-radius:3px; background:var(--bg); overflow:hidden; flex:1; min-width:120px; max-width:260px; }
  .ckbar i { display:block; height:100%; background:var(--deal); }
  .perks { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .perk { background:var(--surface); border:1px solid var(--line); border-radius:var(--r); padding:13px 15px; display:flex; flex-direction:column; gap:4px; }
  .perk:hover { border-color:var(--brand-line); }
  .perk b { font-size:14.5px; }
  .perk span { font-size:13px; color:var(--ink-3); line-height:1.6; }
  .perk em { font-style:normal; font:11.5px var(--mono); color:var(--ink-4); }
  .go:hover { background:var(--brand-2); }
  .copy { border:1px solid var(--line-2); background:var(--surface); border-radius:15px; font-size:12px; padding:2px 11px; color:var(--ink-3); }
  .copy:hover { border-color:var(--brand); color:var(--brand); }
  .copy.done { color:var(--deal); border-color:var(--deal); }
  mark { background:#fde68a; color:inherit; border-radius:2px; padding:0 1px; }

  /* \u8F83\u65E9\u53D1\u5E03 */
  .oldbar { margin:22px 0 4px; display:flex; align-items:center; gap:12px; color:var(--ink-3); font-size:13px; }
  .oldbar::before, .oldbar::after { content:""; flex:1; height:1px; background:var(--line-2); }
  .oldbar button { border:1px solid var(--line-2); background:var(--surface); border-radius:16px; padding:5px 14px; font-size:13px; color:var(--ink-2); }
  .oldbar button:hover { border-color:var(--brand); color:var(--brand); }
  .feed.old .item { opacity:.82; }

  /* \u8282\u70B9\u8BA2\u9605 */
  .warn { background:var(--cond-bg); color:var(--cond); border-radius:var(--r); padding:10px 14px; font-size:13px; margin-bottom:12px; line-height:1.7; }
  .subs { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
  .sub { background:var(--surface); border:1px solid var(--line); border-radius:var(--r); padding:14px 16px; display:flex; flex-direction:column; gap:8px; }
  .sub .hd { display:flex; align-items:center; gap:8px; }
  .sub .hd b { font-size:15px; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .sub .hd .time { flex:none; }
  .sub .msg { color:var(--ink-4); font-size:12.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .sub .ln { display:flex; gap:8px; align-items:center; }
  .sub .ln span { font-size:12px; font-weight:600; color:var(--ink-2); width:72px; flex:none; }
  .sub .ln code { flex:1; min-width:0; font:11.5px var(--mono); color:var(--ink-3); background:var(--bg); border-radius:4px; padding:3px 7px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .fresh { width:8px; height:8px; border-radius:50%; background:var(--deal); flex:none; }
  .fresh.stale { background:var(--ink-4); }

  /* ---------- \u53F3\u4FA7\u680F ---------- */
  .aside { display:flex; flex-direction:column; gap:12px; position:sticky; top:calc(var(--head) + 60px); align-self:start; }
  .box { background:var(--surface); border:1px solid var(--line); border-radius:var(--r); padding:14px 16px; }
  .box h3 { margin:0 0 10px; font-size:14px; display:flex; align-items:center; gap:6px; }
  .box h3::before { content:""; width:3px; height:14px; border-radius:2px; background:var(--brand); }
  .stats { display:grid; grid-template-columns:repeat(3,1fr); text-align:center; }
  .stats b { display:block; font:700 20px/1.2 var(--mono); color:var(--brand); }
  .stats span { font-size:12px; color:var(--ink-4); }
  .upd { font-size:12px; color:var(--ink-4); margin-top:10px; text-align:center; }
  .rank a { display:flex; align-items:center; gap:8px; padding:5px 0; font-size:13px; color:var(--ink-2); cursor:pointer; }
  .rank a:hover { color:var(--brand); }
  .rank i { font-style:normal; width:18px; height:18px; border-radius:4px; background:var(--bg); color:var(--ink-4); font:600 11px/18px var(--mono); text-align:center; flex:none; }
  .rank a:nth-child(-n+3) i { background:var(--brand); color:#fff; }
  .rank span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .rank em { font-style:normal; font:11px var(--mono); color:var(--ink-4); }
  .rss a { display:block; text-align:center; border:1px solid var(--brand-line); color:var(--brand); border-radius:6px; padding:7px 0; font-size:13px; font-weight:600; margin-top:8px; }
  .rss p { margin:0; font-size:12.5px; color:var(--ink-3); line-height:1.7; }

  .more { display:block; margin:16px auto 0; border:1px solid var(--line-2); background:var(--surface); border-radius:18px; padding:7px 20px; color:var(--ink-3); font-size:13px; }
  .empty { background:var(--surface); border:1px solid var(--line); border-radius:var(--r); color:var(--ink-4); text-align:center; padding:70px 20px; line-height:1.9; }
  .empty b { display:block; color:var(--ink); font-size:16px; margin-bottom:2px; }
  .empty a { color:var(--brand); font-weight:600; }
  .skel { height:92px; border-radius:var(--r); background:linear-gradient(90deg,var(--surface),var(--hover),var(--surface)); background-size:200% 100%; animation:sk 1.1s infinite; }
  @keyframes sk { to { background-position:-200% 0; } }
  .toast { position:fixed; left:50%; bottom:calc(24px + env(safe-area-inset-bottom)); transform:translate(-50%,8px); background:#222; color:#fff; padding:8px 16px; border-radius:18px; font-size:13px; opacity:0; transition:opacity .15s, transform .15s; pointer-events:none; z-index:60; }
  .toast.on { opacity:1; transform:translate(-50%,0); }
  .top-btn { position:fixed; right:18px; bottom:calc(22px + env(safe-area-inset-bottom)); width:40px; height:40px; border-radius:50%; border:1px solid var(--line-2); background:var(--surface); color:var(--ink-3); display:none; font-size:16px; z-index:30; }
  .top-btn.on { display:block; }

  @media (max-width:980px) {
    .main { grid-template-columns:minmax(0,1fr); }
    .aside { position:static; order:-1; }
    .aside .box:not(.sbox) { display:none; }
    .subs, .perks { grid-template-columns:1fr; }
  }
  @media (max-width:640px) {
    :root { --head:52px; }
    .wrap { padding:0 10px; }
    .head .wrap { gap:10px; }
    .logo small, .head .links a.d { display:none; }
    .logo { font-size:16px; }
    .logo i { width:26px; height:26px; }
    .search input { height:32px; padding-right:12px; }
    .search button { display:none; }
    .tab { padding:10px 12px 9px; font-size:14px; }
    .filters { padding:8px 10px; }
    .frow { flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none; }
    .frow::-webkit-scrollbar { display:none; }
    .frow > b { width:auto; margin-right:2px; }
    .chip { flex:none; }
    .item { grid-template-columns:44px minmax(0,1fr); gap:10px; padding:12px; }
    .badge { width:44px; height:44px; font-size:13px; border-radius:6px; }
    .side { grid-column:1 / -1; flex-direction:row; align-items:center; justify-content:flex-end; min-width:0; }
    .side .time { margin-right:auto; }
    .side { flex-wrap:wrap; }
    .t { font-size:15px; }
    .stats b { font-size:18px; }
  }
  @media (prefers-reduced-motion: reduce) { * { transition:none !important; animation:none !important; } }
</style>
</head>
<body>
<header class="head">
  <div class="wrap">
    <a class="logo" href="/"><i></i>\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE<small>\u6BCF\u65E5\u767D\u5AD6\u60C5\u62A5</small></a>
    <form class="search" onsubmit="event.preventDefault();go({ q: $('#q').value.trim() })"><input id="q" placeholder="\u641C\u8D44\u6E90\u3001\u6765\u6E90\u3001\u7F51\u5740" aria-label="\u641C\u7D22" autocomplete="off" /><button>\u641C\u7D22</button></form>
    <nav class="links"><a href="/feed.xml" target="_blank" class="d">RSS</a><a href="/admin">\u540E\u53F0</a></nav>
  </div>
</header>
<nav class="tabs"><div class="wrap" id="tabs"></div></nav>
<div class="wrap main">
  <section>
    <div class="filters" id="filters"></div>
    <div id="list"><div class="feed"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div></div>
  </section>
  <aside class="aside">
    <div class="box sbox"><h3>\u4ECA\u65E5\u60C5\u62A5</h3><div class="stats" id="stats"></div><div class="upd" id="upd"></div></div>
    <div class="box"><h3>\u6D3B\u8DC3\u6765\u6E90</h3><div class="rank" id="rank"></div></div>
    <div class="box rss"><h3>\u8BA2\u9605</h3><p>\u6BCF\u5929\u81EA\u52A8\u6536\u96C6\u534A\u5E74\u5185\u53D1\u5E03\u7684\u514D\u8D39\u8D44\u6E90\u3001AI \u989D\u5EA6\u3001\u79D1\u6280\u8D44\u8BAF\u548C\u516C\u5171\u8282\u70B9\u3002\u6570\u636E\u4FDD\u7559 <b id="ret">15</b> \u5929\u3002\u6536\u85CF\u3001\u5DF2\u8BFB\u548C\u7B7E\u5230\u8BB0\u5F55\u53EA\u5B58\u5728\u4F60\u7684\u6D4F\u89C8\u5668\u91CC\u3002</p><a href="/feed.xml" target="_blank">\u25C9 RSS \u8BA2\u9605</a></div>
  </aside>
</div>
<button class="top-btn" id="topBtn" onclick="scrollTo({ top: 0, behavior: 'smooth' })" aria-label="\u56DE\u5230\u9876\u90E8">\u2191</button>
<div class="toast" id="toast"></div>
<script>
const BOOT = /*__BOOT__*/null;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const OB = { free: '\u76F4\u63A5\u767D\u5AD6', conditional: '\u6709\u6761\u4EF6', lottery: '\u62BD\u5956', trial: '\u8BD5\u7528', promo: '\u63A8\u5E7F', paid: '\u9700\u4ED8\u8D39' };
const $ = (s) => document.querySelector(s);
const PAGE = 50, DAY = 86400000;
// \u865A\u62DF\u680F\u76EE\uFF1A\u4E0D\u6309\u5206\u7C7B\uFF0C\u800C\u662F\u6309\u201C\u7528\u9014\u201D\u6311\u6761\u76EE
const VIEWS = [
  { key: 'v:weekly', label: '\u672C\u5468\u7CBE\u9009' },
  { key: 'v:soon', label: '\u5373\u5C06\u622A\u6B62' },
  { key: 'v:codes', label: '\u5151\u6362\u7801' },
  { key: 'v:checkin', label: '\u7B7E\u5230' },
  { key: 'v:perks', label: '\u5B66\u751F / \u5F00\u53D1\u8005' },
  { key: 'v:fav', label: '\u6211\u7684\u6536\u85CF' },
];
const CHECKIN_RE = /\u7B7E\u5230|\u6BCF\u65E5\u9886\u53D6|\u6BCF\u5929\u9886\u53D6|\u6BCF\u65E5\u767B\u5F55|daily\\s*check-?in|\u6BCF\u65E5\u989D\u5EA6/i;
const state = { grp: localStorage.getItem('frr_grp') || '', cat: '', ob: '', src: '', vendor: '', perk: '', q: '', shown: PAGE, showOld: false, data: null, list: [], oldItems: null, oldLoading: false, cat_map: {} };

// ---- \u672C\u5730\u5B58\u50A8\uFF1A\u6536\u85CF\u3001\u5DF2\u8BFB\u3001\u6295\u7968\u3001\u7B7E\u5230 ----
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
let FAV = ls('frr_fav', {});        // id \u2192 \u6761\u76EE\u5FEB\u7167\uFF08\u6761\u76EE\u88AB\u6E05\u7406\u540E\u6536\u85CF\u8FD8\u5728\uFF09
let READ = new Set(ls('frr_read', []));
let VOTES = ls('frr_votes', {});    // id \u2192 1 / -1
let MYCK = ls('frr_myck', []);      // \u81EA\u5DF1\u52A0\u7684\u7B7E\u5230 [{name, url}]
const bjDay = (t) => (t ? new Date(t + 8 * 3600000).toISOString().slice(0, 10) : '');
const ckKey = () => 'frr_ck_' + bjDay(Date.now());
let CKD = ls(ckKey(), {});          // \u4ECA\u5929\u7B7E\u8FC7\u7684 url \u2192 true
function markRead(id) { if (READ.has(id)) return; READ.add(id); lsSet('frr_read', [...READ].slice(-3000)); const el = document.getElementById('i-' + id); if (el) el.classList.add('read'); }

const pubOf = (it) => it.published_at || it.fetched_at || 0;
function ago(t) {
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return Math.max(m, 1) + ' \u5206\u949F\u524D';
  if (m < 1440) return Math.round(m / 60) + ' \u5C0F\u65F6\u524D';
  if (m < 43200) return Math.round(m / 1440) + ' \u5929\u524D';
  return new Date(t).toLocaleDateString('zh-CN');
}
const host = (u) => { try { return new URL(u).hostname.replace(/^www\\./, ''); } catch { return ''; } };
function hl(s) {
  const t = esc(s);
  if (!state.q) return t;
  const q = esc(state.q).replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
  return t.replace(new RegExp(q, 'gi'), (m) => '<mark>' + m + '</mark>');
}
function sched(d) { return d.every && d.every < 24 ? '\u6BCF ' + d.every + ' \u5C0F\u65F6\u6293\u53D6' : '\u6BCF\u5929 ' + d.run_hour + ':00 \u6293\u53D6'; }
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 1500); }
function dayLabel(d) {
  if (!d) return '\u53D1\u5E03\u65F6\u95F4\u4E0D\u8BE6';
  const [, m, dd] = d.split('-').map(Number);
  const diff = Math.round((Date.parse(bjDay(Date.now())) - Date.parse(d)) / DAY);
  return (diff === 0 ? '\u4ECA\u5929 \xB7 ' : diff === 1 ? '\u6628\u5929 \xB7 ' : diff === 2 ? '\u524D\u5929 \xB7 ' : '') + m + '\u6708' + dd + '\u65E5';
}
function leftText(t) {
  const d = Math.ceil((t - Date.now()) / DAY);
  if (t < Date.now()) return '\u5DF2\u622A\u6B62';
  if (bjDay(t) === bjDay(Date.now())) return '\u4ECA\u5929\u622A\u6B62';
  return d <= 1 ? '\u660E\u5929\u622A\u6B62' : '\u5269 ' + d + ' \u5929';
}
const catOf = (it) => state.cat_map[it.category] || { label: '\u5176\u5B83', color: '#8a93a1', group: 'fuli' };
const SHORT = { domain: '\u57DF\u540D', hosting: '\u4E3B\u673A', cloud: '\u4E91\u670D\u52A1', ai: 'AI', aideal: '\u798F\u5229', aitool: '\u5DE5\u5177', software: '\u8F6F\u4EF6', dev: '\u5F00\u53D1', game: '\u6E38\u620F', media: '\u5F71\u97F3', design: '\u7D20\u6750', edu: '\u5B66\u751F', course: '\u7F51\u8BFE', pan: '\u7F51\u76D8', goods: '\u5B9E\u7269', invite: '\u9080\u8BF7', ainews: 'AI\u8BAF', news: '\u8D44\u8BAF', proxy: '\u8282\u70B9', other: '\u5176\u5B83' };
const short = (it, label) => SHORT[it.category] || label.replace(/[\\s/\xB7]+/g, '').slice(0, 2);
function copyText(t, btn) {
  navigator.clipboard?.writeText(t).then(() => { if (btn) { const o = btn.textContent; btn.textContent = '\u5DF2\u590D\u5236'; btn.classList.add('done'); setTimeout(() => { btn.textContent = o; btn.classList.remove('done'); }, 1300); } else toast('\u5DF2\u590D\u5236'); }, () => toast('\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u957F\u6309\u590D\u5236'));
}
const codesOf = (it) => (it.extra && it.extra.codes) || [];
const isSub = (it) => !!(it.extra && it.extra.subs);

function itemHtml(it, i, opt = {}) {
  const c = catOf(it);
  const old = opt.old;
  const isNew = !!it.published_at && Date.now() - it.published_at < DAY && !old;
  const tags = [];
  if (isNew) tags.push('<span class="tg new">\u65B0</span>');
  if (it.dead) tags.push('<span class="tg dead" title="\u62BD\u67E5\u65F6\u6253\u4E0D\u5F00\uFF0C\u6216\u9875\u9762\u5199\u7740\u5DF2\u7ED3\u675F">\u53EF\u80FD\u5931\u6548</span>');
  else if (it.expires_at) tags.push('<span class="tg ' + (it.expires_at - Date.now() < 3 * DAY ? 'soon' : 'old') + '" title="\u622A\u6B62 ' + esc(new Date(it.expires_at).toLocaleString('zh-CN')) + '">' + leftText(it.expires_at) + '</span>');
  if (old) tags.push('<span class="tg old">' + Math.round((Date.now() - pubOf(it)) / DAY) + ' \u5929\u524D\u53D1\u5E03</span>');
  if (it.extra && it.extra.perk) tags.push('<span class="tg hot">' + esc(it.extra.perk) + '</span>');
  if (!c.info && it.obtain && OB[it.obtain] && !(it.extra && it.extra.perk && it.obtain === 'free')) tags.push('<span class="tg ' + (it.obtain === 'free' ? 'free' : '') + '">' + OB[it.obtain] + '</span>');
  const srcs = it.srcs
    ? '<span class="srcs" title="\u540C\u4E00\u4E2A\u5730\u5740\u88AB\u591A\u4E2A\u6765\u6E90\u63D0\u5230">' + it.srcs.length + ' \u4E2A\u6765\u6E90\uFF1A' + it.srcs.map((x) => '<a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + hl(x.n || '') + '</a>').join(' / ') + '</span>'
    : '<span>' + hl(it.source || '') + '</span>';
  const how = it.extra && it.extra.how;
  const codes = codesOf(it);
  const mv = VOTES[it.id] || 0;
  return '<article class="item' + (READ.has(it.id) ? ' read' : '') + (it.dead ? ' dead' : '') + '" id="i-' + it.id + '" style="--c:' + c.color + '">' +
    '<div class="badge">' + (opt.rank ? '<span class="rankn">' + opt.rank + '</span>' : '') + esc(short(it, c.label)) + '</div>' +
    '<div><a class="t" data-read="' + it.id + '" href="' + esc(it.url) + '" target="_blank" rel="noopener">' + hl(it.name || it.title) + '</a>' + (tags.length ? '<span class="tags">' + tags.join('') + '</span>' : '') +
    (it.summary ? '<div class="sum">' + hl(it.summary) + '</div>' : '') +
    (how ? '<div class="how"><b>\u600E\u4E48\u9886\uFF1A</b>' + hl(how) + '</div>' : '') +
    (codes.length ? '<div class="codes">' + codes.map((x) => '<span class="code">' + esc(x) + '<button data-copy="' + esc(x) + '">\u590D\u5236</button></span>').join('') + '</div>' : '') +
    '<div class="meta"><span class="cat">' + esc(c.label) + '</span>' + (it.extra && it.extra.vendor ? '<a data-vd="' + esc(it.extra.vendor) + '" title="\u53EA\u770B\u8FD9\u4E2A\u5382\u5546">\u5382\u5546\uFF1A' + esc(it.extra.vendor) + '</a>' : '') + srcs + (it.signup ? '<span>\u6CE8\u518C\uFF1A' + esc(it.signup) + '</span>' : '') + '<span class="host">' + esc(host(it.url)) + '</span></div></div>' +
    '<div class="side"><span class="time" title="' + esc(new Date(pubOf(it)).toLocaleString('zh-CN')) + '">' + (it.published_at ? '' : '\u6536\u5F55\u4E8E ') + ago(pubOf(it)) + '</span>' +
    '<a class="go" data-read="' + it.id + '" href="' + esc(it.url) + '" target="_blank" rel="noopener">\u76F4\u8FBE\u94FE\u63A5</a>' +
    '<div class="acts">' + (c.info ? '' : '<button class="vb' + (mv === 1 ? ' on' : '') + '" data-vote="' + it.id + '" data-v="1" title="\u503C\u5F97\u4E00\u9886">\u503C ' + (it.up || 0) + '</button><button class="vb no' + (mv === -1 ? ' on' : '') + '" data-vote="' + it.id + '" data-v="-1" title="\u4E0D\u503C / \u6709\u5751">\u4E0D\u503C' + (it.down ? ' ' + it.down : '') + '</button>') +
    '<button class="star' + (FAV[it.id] ? ' on' : '') + '" data-fav="' + it.id + '" title="' + (FAV[it.id] ? '\u53D6\u6D88\u6536\u85CF' : '\u6536\u85CF') + '">' + (FAV[it.id] ? '\u2605' : '\u2606') + '</button></div></div></article>';
}
function subHtml(it) {
  const subs = (it.extra && it.extra.subs) || [];
  const age = Date.now() - pubOf(it);
  const nodes = it.extra && it.extra.nodes;
  return '<div class="sub"><div class="hd"><span class="fresh' + (age > 3 * DAY ? ' stale' : '') + '" title="' + (age > 3 * DAY ? '3 \u5929\u4EE5\u4E0A\u6CA1\u66F4\u65B0\uFF0C\u53EF\u80FD\u5927\u591A\u5DF2\u5931\u6548' : '\u8FD1 3 \u5929\u6709\u66F4\u65B0') + '"></span><b>' + hl(it.name || it.title) + '</b><span class="time">' + ago(pubOf(it)) + '\u66F4\u65B0</span></div>' +
    '<div class="msg">' + (nodes != null ? '\u7EA6 ' + nodes + (it.extra.nodes_more ? '+' : '') + ' \u4E2A\u8282\u70B9 \xB7 ' : '') + esc(it.summary || '') + '</div>' +
    subs.map((s) => '<div class="ln"><span>' + esc(s[0]) + '</span><code title="' + esc(s[1]) + '">' + esc(s[1]) + '</code><button class="copy" data-copy="' + esc(s[1]) + '">\u590D\u5236</button></div>').join('') +
    '<div class="ln" style="justify-content:flex-end"><a class="copy" href="' + esc(it.url) + '" target="_blank" rel="noopener">\u4ED3\u5E93</a>' + (it.extra && it.extra.commit ? '<a class="copy" href="' + esc(it.extra.commit) + '" target="_blank" rel="noopener">\u6700\u8FD1\u63D0\u4EA4</a>' : '') + '</div></div>';
}

// ---- \u672C\u5730\u7B5B\u9009 ----
function matches(it, skip) {
  const c = catOf(it);
  const g = state.grp;
  if (skip !== 'grp' && g && !g.startsWith('v:') && c.group !== g) return false;
  if (skip !== 'cat' && state.cat && it.category !== state.cat) return false;
  if (skip !== 'ob' && state.ob && it.obtain !== state.ob) return false;
  if (skip !== 'vendor' && state.vendor && !(it.extra && it.extra.vendor === state.vendor)) return false;
  if (skip !== 'perk' && state.perk && !(it.extra && it.extra.perk === state.perk)) return false;
  if (skip !== 'src' && state.src && !(it.source === state.src || (it.srcs && it.srcs.some((x) => x.n === state.src)))) return false;
  if (state.q) {
    const q = state.q.toLowerCase();
    if (!((it.name || '') + ' ' + it.title + ' ' + (it.summary || '') + ' ' + codesOf(it).join(' ') + ' ' + (it.srcs ? it.srcs.map((x) => x.n).join(' ') : it.source || '') + ' ' + it.url).toLowerCase().includes(q)) return false;
  }
  return true;
}
function count(fn, skip) { const m = {}; let all = 0; for (const it of state.data.items) if (matches(it, skip)) { all++; const k = fn(it); m[k] = (m[k] || 0) + 1; } m[''] = all; return m; }
const liveNow = (it) => !it.dead && !(it.expires_at && it.expires_at < Date.now());
// \u5404\u865A\u62DF\u680F\u76EE\u7684\u6761\u76EE
function viewItems(key) {
  const d = state.data, items = d.items;
  if (key === 'v:weekly') { const by = new Map(items.map((x) => [x.id, x])); return d.weekly.map((id) => by.get(id)).filter(Boolean); }
  if (key === 'v:soon') return items.filter((x) => x.expires_at && x.expires_at > Date.now() && !x.dead).sort((a, b) => a.expires_at - b.expires_at);
  if (key === 'v:codes') return items.filter((x) => codesOf(x).length && liveNow(x));
  if (key === 'v:checkin') return items.filter((x) => !isSub(x) && !catOf(x).info && CHECKIN_RE.test((x.name || '') + ' ' + x.title + ' ' + (x.summary || '')));
  if (key === 'v:fav') return Object.values(FAV).sort((a, b) => (b._at || 0) - (a._at || 0));
  return [];
}
function viewCount(key) {
  if (key === 'v:perks') return (state.data.perks || []).length;
  if (key === 'v:checkin') return (state.data.checkin || []).length + MYCK.length + viewItems(key).length;
  return viewItems(key).length;
}

function renderTabs() {
  const d = state.data;
  const gc = count((it) => catOf(it).group, 'grp');
  const used = new Set(d.categories.map((c) => c.group));
  const groups = d.groups.filter((g) => used.has(g.key));
  const tab = (key, label, n) => '<button class="tab' + (state.grp === key ? ' on' : '') + '" data-g="' + key + '">' + esc(label) + '<span class="n">' + (n || '') + '</span></button>';
  $('#tabs').innerHTML = tab('', '\u5168\u90E8', gc['']) + groups.map((g) => tab(g.key, g.label, gc[g.key])).join('') + '<span class="sep"></span>' +
    VIEWS.filter((v) => v.key !== 'v:perks' || (d.perks || []).length).map((v) => tab(v.key, v.label, viewCount(v.key))).join('');
}
function renderFilters() {
  const d = state.data;
  if (state.grp.startsWith('v:')) {
    const rows = state.q ? ['<div class="frow"><b>\u5DF2\u7B5B\u9009</b><button class="chip on" data-q="">\u641C\u7D22\uFF1A' + esc(state.q) + ' \u2715</button></div>'] : [];
    $('#filters').innerHTML = rows.join(''); $('#filters').style.display = rows.length ? '' : 'none'; return;
  }
  const cc = count((it) => it.category, 'cat'), oc = count((it) => it.obtain || '', 'ob');
  const cats = d.categories.filter((c) => (!state.grp || c.group === state.grp) && (cc[c.key] || state.cat === c.key));
  const rows = [];
  if (cats.length > 1 || state.cat) rows.push('<div class="frow"><b>\u5206\u7C7B</b><button class="chip' + (!state.cat ? ' on' : '') + '" data-c="">\u5168\u90E8</button>' + cats.map((c) => '<button class="chip' + (state.cat === c.key ? ' on' : '') + '" data-c="' + c.key + '"><span class="d" style="background:' + c.color + '"></span>' + esc(c.label) + '<span class="n">' + cc[c.key] + '</span></button>').join('') + '</div>');
  const infoOnly = state.grp && cats.length && cats.every((c) => c.info);
  if (!infoOnly && (oc.free || oc.conditional || state.ob)) rows.push('<div class="frow"><b>\u83B7\u53D6\u65B9\u5F0F</b><button class="chip' + (!state.ob ? ' on' : '') + '" data-o="">\u4E0D\u9650</button>' + ['free', 'conditional', 'trial'].filter((k) => oc[k] || state.ob === k).map((k) => '<button class="chip' + (state.ob === k ? ' on' : '') + '" data-o="' + k + '">' + OB[k] + '<span class="n">' + oc[k] + '</span></button>').join('') + '</div>');
  // AI \u798F\u5229\uFF1A\u6309\u5382\u5546\u3001\u798F\u5229\u7C7B\u578B\u7B5B
  if (state.grp === 'aifree' || state.vendor || state.perk) {
    const vc = count((it) => (it.extra && it.extra.vendor) || '', 'vendor'), pc = count((it) => (it.extra && it.extra.perk) || '', 'perk');
    const vs = Object.keys(vc).filter((k) => k && vc[k]).sort((a, b) => vc[b] - vc[a]).slice(0, 16);
    const ps = Object.keys(pc).filter((k) => k && pc[k]).sort((a, b) => pc[b] - pc[a]);
    if (ps.length || state.perk) rows.push('<div class="frow"><b>\u798F\u5229\u7C7B\u578B</b><button class="chip' + (!state.perk ? ' on' : '') + '" data-pk="">\u4E0D\u9650</button>' + ps.map((k) => '<button class="chip' + (state.perk === k ? ' on' : '') + '" data-pk="' + esc(k) + '">' + esc(k) + '<span class="n">' + pc[k] + '</span></button>').join('') + '</div>');
    if (vs.length || state.vendor) rows.push('<div class="frow"><b>\u5382\u5546</b><button class="chip' + (!state.vendor ? ' on' : '') + '" data-vd="">\u5168\u90E8</button>' + vs.map((k) => '<button class="chip' + (state.vendor === k ? ' on' : '') + '" data-vd="' + esc(k) + '">' + esc(k) + '<span class="n">' + vc[k] + '</span></button>').join('') + '</div>');
  }
  if (state.src || state.q) rows.push('<div class="frow"><b>\u5DF2\u7B5B\u9009</b>' + (state.src ? '<button class="chip on" data-s="">\u6765\u6E90\uFF1A' + esc(state.src) + ' \u2715</button>' : '') + (state.q ? '<button class="chip on" data-q="">\u641C\u7D22\uFF1A' + esc(state.q) + ' \u2715</button>' : '') + '</div>');
  $('#filters').innerHTML = rows.join('');
  $('#filters').style.display = rows.length ? '' : 'none';
}
function renderAside() {
  const d = state.data;
  const today = bjDay(Date.now());
  const todayN = d.items.filter((x) => x.published_at && bjDay(x.published_at) === today).length;
  const freeN = d.items.filter((x) => x.obtain === 'free' && !catOf(x).info).length;
  const soonN = d.items.filter((x) => x.expires_at && x.expires_at > Date.now() && x.expires_at - Date.now() < 3 * DAY && !x.dead).length;
  $('#stats').innerHTML = '<div><b>' + todayN + '</b><span>\u4ECA\u65E5\u53D1\u5E03</span></div><div><b>' + freeN + '</b><span>\u76F4\u63A5\u767D\u5AD6</span></div><div><b>' + soonN + '</b><span>3 \u5929\u5185\u622A\u6B62</span></div>';
  $('#upd').textContent = (d.last_run ? '\u6700\u8FD1\u66F4\u65B0 ' + ago(d.last_run) : '\u8FD8\u6CA1\u6293\u53D6') + ' \xB7 ' + sched(d) + ' \xB7 \u8FD1 ' + d.fresh_days + ' \u5929 ' + d.items.length + ' \u6761';
  const sc = {};
  for (const it of d.items) if (matches(it, 'src')) for (const n of it.srcs ? it.srcs.map((x) => x.n) : [it.source]) if (n) sc[n] = (sc[n] || 0) + 1;
  const top = Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 10);
  $('#rank').innerHTML = top.length ? top.map(([n, c], i) => '<a data-s="' + esc(n) + '"><i>' + (i + 1) + '</i><span>' + esc(n) + '</span><em>' + c + '</em></a>').join('') : '<span style="color:var(--ink-4);font-size:13px">\u6682\u65E0</span>';
  $('#ret').textContent = d.retention_days;
}
function feedHtml(list, opt = {}) {
  if (opt.flat) return '<div class="feed' + (opt.old ? ' old' : '') + '">' + list.map((it, i) => itemHtml(it, i, { old: opt.old, rank: opt.ranked ? i + 1 : 0 })).join('') + '</div>';
  const groups = [];
  list.forEach((it) => {
    const k = it.published_at ? bjDay(it.published_at) : '';
    if (!groups.length || groups[groups.length - 1].d !== k) groups.push({ d: k, list: [] });
    groups[groups.length - 1].list.push(it);
  });
  return groups.map((g) => '<div class="dayh"><b>' + dayLabel(g.d) + '</b><span>' + g.list.length + ' \u6761</span></div><div class="feed">' + g.list.map((it) => itemHtml(it, 0)).join('') + '</div>').join('');
}
// ---- \u5404\u865A\u62DF\u680F\u76EE ----
function renderView(key) {
  const el = $('#list');
  const d = state.data;
  const filt = (l) => l.filter((it) => matches(it, 'grp'));
  if (key === 'v:perks') {
    const ps = (d.perks || []).filter((p) => !state.q || (p.name + ' ' + (p.note || '')).toLowerCase().includes(state.q.toLowerCase()));
    const grp = (who) => ps.filter((p) => p.who === who);
    const block = (who, desc) => grp(who).length ? '<div class="dayh"><b>' + who + '</b><span>' + desc + '</span></div><div class="perks">' + grp(who).map((p) => '<a class="perk" href="' + esc(p.url) + '" target="_blank" rel="noopener"><b>' + hl(p.name) + '</b><span>' + hl(p.note || '') + '</span><em>' + esc(host(p.url)) + '</em></a>').join('') + '</div>' : '';
    const body = block('\u5B66\u751F', '\u5B66\u6821\u90AE\u7BB1\u6216\u5B66\u751F\u8BA4\u8BC1') + block('\u5F00\u53D1\u8005', '\u957F\u671F\u514D\u8D39\u989D\u5EA6');
    el.innerHTML = '<div class="vhead"><b>\u5B66\u751F / \u5F00\u53D1\u8005\u4E13\u533A</b>\u957F\u671F\u6709\u6548\u7684\u514D\u8D39\u6743\u76CA\uFF0C\u4E0D\u968F\u6BCF\u5929\u7684\u4FE1\u606F\u6D41\u6EDA\u52A8\u3002</div>' + (body || '<div class="empty"><b>\u6CA1\u6709\u5339\u914D\u7684\u6743\u76CA</b></div>');
    return;
  }
  if (key === 'v:checkin') {
    const base = [...(d.checkin || []).map((x) => ({ ...x, own: false })), ...MYCK.map((x) => ({ ...x, own: true }))];
    const auto = filt(viewItems(key)).filter((it) => !base.some((b) => b.url === it.url));
    const done = base.filter((b) => CKD[b.url]).length;
    const ck = (b) => '<label class="ck' + (CKD[b.url] ? ' done' : '') + '"><input type="checkbox" data-ck="' + esc(b.url) + '"' + (CKD[b.url] ? ' checked' : '') + ' /><span><a class="nm" href="' + esc(b.url) + '" target="_blank" rel="noopener">' + esc(b.name) + '</a><small>' + esc(b.note || host(b.url)) + '</small></span>' + (b.own ? '<button class="copy" data-unck="' + esc(b.url) + '">\u79FB\u9664</button>' : '<span></span>') + '</label>';
    el.innerHTML = '<div class="vhead"><b>\u4ECA\u65E5\u7B7E\u5230</b>\u5DF2\u7B7E ' + done + ' / ' + base.length + '<span class="ckbar"><i style="width:' + (base.length ? Math.round(done / base.length * 100) : 0) + '%"></i></span><span class="sp"></span>\u52FE\u9009\u8BB0\u5728\u4F60\u81EA\u5DF1\u7684\u6D4F\u89C8\u5668\u91CC\uFF0C\u6BCF\u5929\u96F6\u70B9\u6E05\u7A7A</div>' +
      (base.length ? '<div class="feed">' + base.map(ck).join('') + '</div>' : '<div class="empty" style="padding:30px 20px"><b>\u8FD8\u6CA1\u6709\u7B7E\u5230\u6E05\u5355</b>\u5728\u4E0B\u9762\u7684\u8D44\u6E90\u4E0A\u70B9\u300C\u52A0\u5165\u7B7E\u5230\u300D\uFF0C\u6216\u8005\u8BA9\u7AD9\u957F\u5728\u540E\u53F0\u586B\u5199\u7B7E\u5230\u6E05\u5355\u3002</div>') +
      (auto.length ? '<div class="dayh"><b>\u6700\u8FD1\u6536\u5F55\u7684\u7B7E\u5230\u7C7B\u8D44\u6E90</b><span>' + auto.length + ' \u6761</span></div><div class="feed">' + auto.map((it) => itemHtml(it, 0).replace('<div class="acts">', '<div class="acts"><button class="vb" data-addck="' + it.id + '">\u52A0\u5165\u7B7E\u5230</button>')).join('') + '</div>' : '');
    return;
  }
  const list = filt(viewItems(key));
  const head = {
    'v:weekly': '<b>\u672C\u5468\u7CBE\u9009</b>\u8FD1 7 \u5929\u6309 AI \u8BC4\u5206\u3001\u300C\u503C / \u4E0D\u503C\u300D\u6295\u7968\u548C\u88AB\u51E0\u4E2A\u6765\u6E90\u63D0\u5230\u6311\u51FA\u7684 10 \u6761\uFF0C\u6BCF\u4E2A\u5206\u7C7B\u6700\u591A 3 \u6761\u3002',
    'v:soon': '<b>\u5373\u5C06\u622A\u6B62</b>\u5199\u660E\u4E86\u622A\u6B62\u65F6\u95F4\u7684\u6D3B\u52A8\uFF0C\u6309\u622A\u6B62\u65F6\u95F4\u5148\u540E\u6392\uFF0C\u8FC7\u671F\u4E00\u5929\u540E\u81EA\u52A8\u4E0B\u67B6\u3002',
    'v:codes': '<b>\u5151\u6362\u7801</b>\u6B63\u6587\u91CC\u76F4\u63A5\u7ED9\u4E86\u5151\u6362\u7801 / \u6FC0\u6D3B\u7801\u7684\uFF0C\u70B9\u4E00\u4E0B\u5C31\u80FD\u590D\u5236\uFF0C\u5148\u5230\u5148\u5F97\u3002',
    'v:fav': '<b>\u6211\u7684\u6536\u85CF</b>\u6536\u85CF\u53EA\u5B58\u5728\u8FD9\u4E2A\u6D4F\u89C8\u5668\u91CC\uFF1B\u6761\u76EE\u8FC7\u671F\u6E05\u7406\u540E\u6536\u85CF\u4ECD\u7136\u4FDD\u7559\u3002',
  }[key];
  el.innerHTML = '<div class="vhead">' + head + (key === 'v:fav' && list.length ? '<span class="sp"></span><button class="copy" data-clearfav="1">\u6E05\u7A7A\u6536\u85CF</button>' : '') + '</div>' +
    (list.length ? feedHtml(list, { flat: true, ranked: key === 'v:weekly' }) : '<div class="empty"><b>' + ({ 'v:fav': '\u8FD8\u6CA1\u6709\u6536\u85CF', 'v:weekly': '\u8FD9\u5468\u8FD8\u6CA1\u6709\u53EF\u9009\u7684\u6761\u76EE', 'v:soon': '\u6682\u65F6\u6CA1\u6709\u5199\u660E\u622A\u6B62\u65F6\u95F4\u7684\u6D3B\u52A8', 'v:codes': '\u6682\u65F6\u6CA1\u6709\u5151\u6362\u7801' }[key]) + '</b>' + (key === 'v:fav' ? '\u70B9\u8D44\u6E90\u53F3\u4E0B\u89D2\u7684 \u2606 \u6536\u85CF' : '') + '</div>');
}
function render() {
  const d = state.data;
  const fresh = Math.max(1, d.fresh_days || 15) * DAY;
  renderTabs(); renderFilters(); renderAside();
  if (state.grp.startsWith('v:')) return renderView(state.grp);
  const all = d.items.filter((it) => matches(it)).sort((a, b) => pubOf(b) - pubOf(a));
  const el = $('#list');
  const filtered = state.grp || state.cat || state.ob || state.src || state.q || state.vendor || state.perk;
  if (!all.length && !d.old_count) {
    el.innerHTML = filtered
      ? '<div class="empty"><b>\u8FD9\u4E2A\u680F\u76EE\u6682\u65F6\u6CA1\u6709\u5185\u5BB9</b>\u6362\u4E2A\u680F\u76EE\uFF0C\u6216\u6E05\u7A7A\u641C\u7D22\u518D\u8BD5\u8BD5</div>'
      : '<div class="empty"><b>\u8FD8\u6CA1\u6709\u6570\u636E</b>' + sched(d) + '\uFF08\u5317\u4EAC\u65F6\u95F4\uFF09\u3002\u521A\u90E8\u7F72\u597D\uFF1F\u53BB <a href="/admin">\u7BA1\u7406\u540E\u53F0</a> \u70B9\u300C\u7ACB\u5373\u6293\u53D6\u300D\u3002</div>';
    return;
  }
  // \u68AF\u5B50\u680F\u76EE\uFF1A\u8BA2\u9605\u5361\u7247\uFF08\u6700\u8FD1\u6709\u66F4\u65B0\u7684\u5728\u524D\uFF09
  if (state.grp === 'proxy' || (state.cat && catOf({ category: state.cat }).group === 'proxy')) {
    const subs = all.filter(isSub).sort((a, b) => pubOf(b) - pubOf(a)), rest = all.filter((it) => !isSub(it));
    state.list = rest;
    el.innerHTML = '<div class="warn">\u4EE5\u4E0B\u662F GitHub \u4E0A\u81EA\u52A8\u66F4\u65B0\u7684\u516C\u5171\u8282\u70B9\u8BA2\u9605\uFF0C\u4ED3\u5E93\u4E00\u6709\u65B0\u63D0\u4EA4\u8FD9\u91CC\u5C31\u5237\u65B0\uFF1B\u7070\u70B9\u8868\u793A 3 \u5929\u4EE5\u4E0A\u6CA1\u66F4\u65B0\u3002\u516C\u5171\u8282\u70B9\u6765\u8DEF\u4E0D\u660E\u3001\u968F\u65F6\u5931\u6548\uFF0C\u8BF7\u52FF\u7528\u6765\u767B\u5F55\u91CD\u8981\u8D26\u53F7\u6216\u4F20\u8F93\u9690\u79C1\u6570\u636E\u3002</div>' +
      (subs.length ? '<div class="subs">' + subs.map(subHtml).join('') + '</div>' : '') +
      (rest.length ? '<div class="dayh"><b>\u76F8\u5173\u5E16\u5B50</b></div><div class="feed">' + rest.map((it) => itemHtml(it, 0)).join('') + '</div>' : '');
    return;
  }
  // \u8282\u70B9\u8BA2\u9605\u5361\u7247\u53EA\u5728\u300C\u514D\u8D39\u68AF\u5B50\u300D\u680F\u76EE\u91CC\u663E\u793A\uFF1B\u7591\u4F3C\u5931\u6548\u7684\u6C89\u5230\u6700\u540E
  const feed = all.filter((it) => !isSub(it));
  const now = Date.now();
  const recent = feed.filter((it) => !it.published_at || now - it.published_at <= fresh);
  state.list = recent.filter((it) => it.published_at && !it.dead).concat(recent.filter((it) => !it.published_at && !it.dead), recent.filter((it) => it.dead));
  const slice = state.list.slice(0, state.shown);
  let html = slice.length ? feedHtml(slice) : '<div class="empty" style="padding:40px 20px"><b>\u8FD1 ' + d.fresh_days + ' \u5929\u6CA1\u6709\u65B0\u53D1\u5E03\u7684\u5185\u5BB9</b>\u53EF\u4EE5\u770B\u770B\u66F4\u65E9\u53D1\u5E03\u7684</div>';
  if (state.list.length > state.shown) html += '<button class="more" id="more">\u518D\u663E\u793A ' + Math.min(PAGE, state.list.length - state.shown) + ' \u6761\uFF08\u5269 ' + (state.list.length - state.shown) + '\uFF09</button>';
  else if (d.old_count) {
    const oldList = state.oldItems ? state.oldItems.filter((it) => matches(it) && !isSub(it)) : null;
    const n = oldList ? oldList.length : d.old_count;
    html += '<div class="oldbar"><button id="oldBtn">' + (state.oldLoading ? '\u52A0\u8F7D\u4E2D\u2026' : (state.showOld ? '\u6536\u8D77' : '\u5C55\u5F00') + ' ' + d.fresh_days + ' \u5929\u524D\u53D1\u5E03\u7684 ' + (oldList ? n : '\u7EA6 ' + n) + ' \u6761') + '</button></div>';
    if (state.showOld && oldList) html += oldList.length ? feedHtml(oldList.slice(0, 300), { flat: true, old: true }) : '<div class="empty" style="padding:30px 20px">\u6CA1\u6709\u7B26\u5408\u7B5B\u9009\u7684\u8F83\u65E9\u5185\u5BB9</div>';
  }
  el.innerHTML = html;
}
async function loadOld() {
  if (state.oldItems || state.oldLoading) return;
  state.oldLoading = true; render();
  try { const r = await fetch('/api/data?old=1'); if (!r.ok) throw 0; const j = await r.json(); state.oldItems = j.items || []; } catch { state.showOld = false; toast('\u52A0\u8F7D\u5931\u8D25\uFF0C\u7A0D\u540E\u518D\u8BD5'); }
  state.oldLoading = false;
}
function setData(d) {
  state.data = d;
  state.cat_map = Object.fromEntries(d.categories.map((c) => [c.key, c]));
  if (state.grp && !state.grp.startsWith('v:') && !d.categories.some((c) => c.group === state.grp)) state.grp = '';
  // \u6536\u85CF\u91CC\u7684\u6761\u76EE\u7528\u6700\u65B0\u6570\u636E\u5237\u65B0\uFF08\u6295\u7968\u6570\u3001\u5931\u6548\u72B6\u6001\uFF09
  for (const it of d.items) if (FAV[it.id]) FAV[it.id] = { ...it, _at: FAV[it.id]._at };
  render();
  loadParts(d);
}
// \u9996\u5C4F\u53EA\u5185\u5D4C\u6700\u65B0\u7684\u4E00\u90E8\u5206\uFF0C\u5176\u4F59\u5206\u5757\u9759\u9ED8\u52A0\u8F7D\uFF08\u6BCF\u5757\u4E00\u6B21\u8F7B\u91CF\u8BF7\u6C42\uFF09
async function loadParts(d) {
  if (!d.parts) return;
  const seen = new Set(d.items.map((x) => x.id));
  const max = d.parts > 0 ? d.parts : 50;
  for (let i = 1; i <= max; i++) {
    let j;
    try { const r = await fetch('/api/data?part=' + i); if (!r.ok) break; j = await r.json(); } catch { break; }
    if (state.data !== d) return; // \u671F\u95F4\u6570\u636E\u5DF2\u66F4\u65B0
    for (const it of j.items || []) if (!seen.has(it.id)) { seen.add(it.id); d.items.push(it); if (FAV[it.id]) FAV[it.id] = { ...it, _at: FAV[it.id]._at }; }
    if (d.parts < 0 && !j.more) break;
    if (i % 2 === 0 || i === max) render();
  }
  render();
}
function go(patch) {
  Object.assign(state, patch, { shown: PAGE });
  if ('grp' in patch) { localStorage.setItem('frr_grp', state.grp); state.cat = ''; state.ob = ''; state.showOld = false; if (!('vendor' in patch)) state.vendor = ''; state.perk = ''; }
  if ('q' in patch) $('#q').value = state.q;
  render();
  scrollTo({ top: 0 });
}
const findItem = (id) => state.data.items.find((x) => x.id === id) || (state.oldItems || []).find((x) => x.id === id) || FAV[id];

// ---- \u4EA4\u4E92 ----
async function doVote(id, v, btn) {
  const cur = VOTES[id] || 0, nv = cur === v ? 0 : v;
  try {
    const r = await fetch('/api/vote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, v: nv }) });
    const j = await r.json();
    if (!r.ok) return toast(j.error || '\u6295\u7968\u5931\u8D25');
    if (nv) VOTES[id] = nv; else delete VOTES[id];
    lsSet('frr_votes', VOTES);
    const it = findItem(id); if (it) { it.up = j.up; it.down = j.down; }
    const art = document.getElementById('i-' + id);
    if (art) { const ups = art.querySelectorAll('[data-vote]'); ups[0].textContent = '\u503C ' + j.up; ups[0].classList.toggle('on', nv === 1); ups[1].textContent = '\u4E0D\u503C' + (j.down ? ' ' + j.down : ''); ups[1].classList.toggle('on', nv === -1); }
    toast(nv === 1 ? '\u5DF2\u6295\u300C\u503C\u300D' : nv === -1 ? '\u5DF2\u6295\u300C\u4E0D\u503C\u300D\uFF0C\u8C22\u8C22\u53CD\u9988' : '\u5DF2\u53D6\u6D88');
  } catch { toast('\u7F51\u7EDC\u9519\u8BEF'); }
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-g],[data-c],[data-o],[data-s],[data-q],[data-vd],[data-pk]');
  if (t) {
    e.preventDefault();
    if ('g' in t.dataset) go({ grp: t.dataset.g });
    else if ('c' in t.dataset) go({ cat: t.dataset.c });
    else if ('o' in t.dataset) go({ ob: t.dataset.o });
    else if ('vd' in t.dataset) go({ vendor: state.vendor === t.dataset.vd && t.closest('.meta') ? '' : t.dataset.vd, grp: state.grp.startsWith('v:') ? '' : state.grp });
    else if ('pk' in t.dataset) go({ perk: t.dataset.pk });
    else if ('s' in t.dataset) go({ src: state.src === t.dataset.s ? '' : t.dataset.s, grp: state.grp.startsWith('v:') ? '' : state.grp });
    else go({ q: '' });
    return;
  }
  const cp = e.target.closest('[data-copy]');
  if (cp) { e.preventDefault(); copyText(cp.dataset.copy, cp); return; }
  const rd = e.target.closest('[data-read]');
  if (rd) { markRead(rd.dataset.read); return; }
  const vb = e.target.closest('[data-vote]');
  if (vb) { doVote(vb.dataset.vote, Number(vb.dataset.v), vb); return; }
  const fv = e.target.closest('[data-fav]');
  if (fv) {
    const id = fv.dataset.fav;
    if (FAV[id]) { delete FAV[id]; toast('\u5DF2\u53D6\u6D88\u6536\u85CF'); } else { const it = findItem(id); if (it) { FAV[id] = { ...it, _at: Date.now() }; toast('\u5DF2\u6536\u85CF'); } }
    lsSet('frr_fav', FAV);
    if (state.grp === 'v:fav') render(); else { fv.classList.toggle('on', !!FAV[id]); fv.textContent = FAV[id] ? '\u2605' : '\u2606'; renderTabs(); }
    return;
  }
  const ad = e.target.closest('[data-addck]');
  if (ad) { const it = findItem(ad.dataset.addck); if (it && !MYCK.some((x) => x.url === it.url)) { MYCK.push({ name: it.name || it.title.slice(0, 30), url: it.url, note: '\u81EA\u5DF1\u52A0\u7684' }); lsSet('frr_myck', MYCK); toast('\u5DF2\u52A0\u5165\u7B7E\u5230\u6E05\u5355'); render(); } return; }
  const un = e.target.closest('[data-unck]');
  if (un) { e.preventDefault(); MYCK = MYCK.filter((x) => x.url !== un.dataset.unck); lsSet('frr_myck', MYCK); render(); return; }
  if (e.target.closest('[data-clearfav]')) { if (confirm('\u6E05\u7A7A\u5168\u90E8\u6536\u85CF\uFF1F')) { FAV = {}; lsSet('frr_fav', FAV); render(); } return; }
  if (e.target.id === 'more') { state.shown += PAGE; render(); }
  if (e.target.id === 'oldBtn') { state.showOld = !state.showOld; if (state.showOld && !state.oldItems) loadOld().then(render); else render(); }
});
document.addEventListener('change', (e) => {
  const ck = e.target.closest('[data-ck]');
  if (!ck) return;
  CKD = ls(ckKey(), {});
  if (ck.checked) CKD[ck.dataset.ck] = true; else delete CKD[ck.dataset.ck];
  lsSet(ckKey(), CKD);
  for (const k of Object.keys(localStorage)) if (k.startsWith('frr_ck_') && k !== ckKey()) localStorage.removeItem(k);
  render();
});
let qt = 0;
$('#q').oninput = () => { clearTimeout(qt); qt = setTimeout(() => go({ q: $('#q').value.trim() }), 200); };
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== $('#q')) { e.preventDefault(); $('#q').focus(); }
  if (e.key === 'Escape' && $('#q').value) { go({ q: '' }); $('#q').blur(); }
});
addEventListener('scroll', () => {
  $('#topBtn').classList.toggle('on', scrollY > 800);
  if (state.data && !state.grp.startsWith('v:') && state.list.length > state.shown && innerHeight + scrollY > document.body.scrollHeight - 600) { state.shown += PAGE; render(); }
}, { passive: true });

// ---- \u6570\u636E\uFF1A\u9875\u9762\u5185\u5D4C\u9996\u5C4F\u6570\u636E\uFF1B\u4E4B\u540E\u9759\u9ED8\u5237\u65B0\uFF08\u6709 ETag\uFF0C\u6CA1\u53D8\u5316\u65F6\u51E0\u4E4E\u4E0D\u8017\u6D41\u91CF\uFF09 ----
async function refresh() {
  try {
    const r = await fetch('/api/data', { cache: 'no-cache' });
    if (r.status === 401) return location.reload();
    if (r.ok) { const d = await r.json(); if (!state.data || d.ver !== state.data.ver || (d.ver === 'live' && d.last_run !== state.data.last_run)) { state.oldItems = null; setData(d); } }
  } catch {}
}
if (BOOT) setData(BOOT); else refresh();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { CKD = ls(ckKey(), {}); refresh(); } });
setInterval(() => { if (!document.hidden) refresh(); }, 5 * 60000);
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
var envToken = (env) => {
  const t = String(env.ADMIN_TOKEN || "").trim();
  return t && t !== "change-me" ? t : "";
};
async function isAdmin(req, env) {
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!got) return false;
  if (envToken(env)) return safeEqual(got, envToken(env));
  const h = await getAdminHash(env);
  return !!h && safeEqual(await sha256("frr:" + got), h);
}
function resolveAi(target, body, s) {
  const key = body.api_key && !String(body.api_key).includes("****") ? body.api_key : s.ai_api_key;
  return { baseUrl: body.base_url || s.ai_base_url, apiKey: key, model: body.model || s.ai_model, extra: "{}" };
}
var MEMO = /* @__PURE__ */ new Map();
async function memo(key, ttlMs, fn) {
  const hit = MEMO.get(key);
  if (hit && hit.exp > Date.now()) return hit.v;
  const v = await fn();
  MEMO.set(key, { v, exp: Date.now() + ttlMs });
  return v;
}
var clearMemo = () => MEMO.clear();
var etagOf = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 7) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `W/"${(h >>> 0).toString(36)}-${s.length.toString(36)}"`;
};
function cached(req, body, type, extra = {}) {
  const etag = etagOf(body);
  const headers = { "content-type": type, etag, "cache-control": "no-cache", ...extra };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { headers });
}
var basic = (env) => memo("basic", 15e3, () => getBasicSettings(env));
var [PAGE_A, PAGE_B] = public_default.split("/*__BOOT__*/null");
var STATIC_PAGE = PAGE_A + "null" + PAGE_B;
async function dataResp(req, url, env, JS) {
  if (url.searchParams.get("old") === "1") return sendSnap(req, await pageData(env, "old"), JS);
  const part = Number(url.searchParams.get("part")) || 0;
  if (part > 0) return sendSnap(req, await pageData(env, "part:" + Math.min(part, 50)), JS);
  return sendSnap(req, await pageData(env, "head"), JS);
}
async function snapOrLive(env, part) {
  const r = await readSnap(env, part);
  if (r && r.v) return { v: r.v, tag: r.ver + ":" + part };
  markDirty(env);
  const v = part === "head" ? await liveHead(env) : part === "old" ? await liveOld(env) : await livePart(env, Number(part.split(":")[1]) || 1);
  return { v, tag: "live:" + part + ":" + Math.floor(Date.now() / 6e4) };
}
var pageData = (env, part) => memo("snap:" + part, 2e4, () => snapOrLive(env, part));
function sendSnap(req, d, type, body) {
  const etag = `W/"${d.tag}"`;
  const headers = { "content-type": type, etag, "cache-control": "no-cache" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(body ?? d.v, { headers });
}
var RL = /* @__PURE__ */ new Map();
function rateOk(key, limit, windowMs = 6e4) {
  if (!limit) return true;
  const now = Date.now();
  let e = RL.get(key);
  if (!e || e.reset < now) {
    if (RL.size > 5e3) RL.clear();
    e = { n: 0, reset: now + windowMs };
    RL.set(key, e);
  }
  return ++e.n <= limit;
}
var ipOf = (req) => req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "local";
var FAIL_WINDOW = 15 * 6e4;
async function failsOf(env, ip) {
  const r = await env.DB.prepare("SELECT n, reset FROM rate WHERE k = ?").bind("login:" + ip).first();
  return r && r.reset > Date.now() ? r.n : 0;
}
function addFail(env, ip) {
  const now = Date.now();
  return env.DB.prepare("INSERT INTO rate (k, n, reset) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN rate.reset < ? THEN 1 ELSE rate.n + 1 END, reset = CASE WHEN rate.reset < ? THEN excluded.reset ELSE rate.reset END").bind("login:" + ip, now + FAIL_WINDOW, now, now).run().catch(() => {
  });
}
var tooMany = () => json({ error: "\u5BC6\u7801\u9519\u8BEF\u6B21\u6570\u592A\u591A\uFF0C\u8BF7 15 \u5206\u949F\u540E\u518D\u8BD5" }, 429);
async function vote(req, env) {
  const { id, v } = await req.json().catch(() => ({}));
  const val = Number(v);
  if (!/^[0-9a-f]{40}$/.test(String(id || "")) || ![1, -1, 0].includes(val)) return json({ error: "\u53C2\u6570\u4E0D\u5BF9" }, 400);
  const voter = (await sha256("vote:" + ipOf(req))).slice(0, 24);
  const prev = await env.DB.prepare("SELECT v FROM votes WHERE id = ? AND voter = ?").bind(id, voter).first();
  const pv = prev?.v || 0;
  if (pv === val) {
    const r2 = await env.DB.prepare("SELECT up, down FROM items WHERE id = ?").bind(id).first();
    return json({ ok: true, up: r2?.up || 0, down: r2?.down || 0, mine: val });
  }
  const du = (val === 1) - (pv === 1), dd = (val === -1) - (pv === -1);
  await env.DB.batch([
    val ? env.DB.prepare("INSERT INTO votes (id, voter, v, at) VALUES (?, ?, ?, ?) ON CONFLICT(id, voter) DO UPDATE SET v = excluded.v, at = excluded.at").bind(id, voter, val, Date.now()) : env.DB.prepare("DELETE FROM votes WHERE id = ? AND voter = ?").bind(id, voter),
    env.DB.prepare("UPDATE items SET up = MAX(0, up + ?), down = MAX(0, down + ?) WHERE id = ?").bind(du, dd, id)
  ]);
  const r = await env.DB.prepare("SELECT up, down FROM items WHERE id = ?").bind(id).first();
  const st = await basic(env);
  const hide = Number(st.vote_hide) || 0;
  if (r && hide > 0 && r.down - r.up >= hide) await env.DB.prepare("UPDATE items SET status = 'rejected', judged_by = 'votes', judged_at = ? WHERE id = ?").bind(Date.now(), id).run();
  return json({ ok: true, up: r?.up || 0, down: r?.down || 0, mine: val });
}
async function publicItems(env, url) {
  const s = await basic(env);
  const cutoff = Date.now() - (Number(s.max_age_days) || 180) * 864e5;
  const where = ["status = 'approved'", "dead = 0", "(published_at IS NULL OR published_at >= ?)"];
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
  if (p === "/snap" && m === "POST") {
    const r = await snapStep(env, !!body.force);
    clearMemo();
    return json(r || { done: true, idle: true });
  }
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
  if (p === "/run" && m === "POST") return json(await planRun(env, "manual"));
  if (p === "/rejudge" && m === "POST") {
    const s = await getSettings(env);
    if (!(s.ai_enabled !== "false" && s.ai_api_key && s.ai_base_url && s.ai_model)) return json({ error: "\u8BF7\u5148\u586B\u597D AI \u63A5\u53E3\u5730\u5740\u3001Key \u548C\u6A21\u578B\u5E76\u4FDD\u5B58" }, 400);
    const r = await env.DB.prepare("UPDATE items SET status = 'pending', attempts = 0 WHERE judged_by = 'keywords' OR (status = 'rejected' AND judged_by IS NULL)").run();
    const plan = await planRun(env, "rejudge", { only: "judge", cap: 300 });
    return json({ ...plan, reset: r.meta?.changes || 0 });
  }
  if (p === "/site-password" && m === "POST") {
    await setSitePass(env, String(body.password || "").trim());
    return json({ ok: true, locked: !!String(body.password || "").trim() });
  }
  if (p === "/step" && m === "POST") return json(await tick(env, Math.min(5, Math.max(1, Number(body.n) || 1))));
  if (p === "/cron-key" && m === "GET") return json({ key: await getCronKey(env), last: Number(await getMeta(env, "trigger_last")) || 0 });
  if (p === "/cron-key" && m === "POST") return json({ key: await getCronKey(env, true) });
  if (p === "/search-test" && m === "POST") {
    const s = await getSettings(env);
    if (!BACKEND_MAP[body.provider]) return json({ error: "\u672A\u77E5\u641C\u7D22\u540E\u7AEF" }, 400);
    const t0 = Date.now();
    const r = await runBackend({ ...s, search_max_queries: "2" }, body.provider, Number(s.max_age_days) || 180);
    return json({ ok: true, ms: Date.now() - t0, count: r.items.length, errors: r.errors, sample: r.items.slice(0, 8).map((x) => ({ title: x.title, url: x.url, date: x.published_at ? new Date(x.published_at).toISOString().slice(0, 10) : null })) });
  }
  if (p === "/sources/check" && m === "POST") {
    const s = await getSettings(env);
    let current = [];
    try {
      current = JSON.parse(body.sources ?? s.sources);
    } catch {
    }
    const urls = String(body.urls ?? s.source_sync_urls ?? "").split(/\r?\n/).map((x) => x.trim()).filter((x) => /^https?:\/\//.test(x)).slice(0, 5);
    return json(await checkSources(Array.isArray(current) ? current : [], urls));
  }
  if ((p === "/sources/probe" || p === "/sources/discover") && m === "POST") {
    const s = await getSettings(env);
    let current = [];
    try {
      current = JSON.parse(body.sources ?? s.sources);
    } catch {
    }
    if (!Array.isArray(current)) current = [];
    if (p === "/sources/probe") return json(await probeInputs(current, String(body.lines || "").split(/\r?\n/)));
    const kw = String(body.keyword || "").trim().slice(0, 40);
    if (!kw) return json({ error: "\u8BF7\u8F93\u5165\u5173\u952E\u8BCD" }, 400);
    return json(await discoverSources(current, kw, (qs) => searchForDiscovery(s, qs)));
  }
  if (p === "/mail/test" && m === "POST") {
    const ch = body.channel === "telegram" || /^push:\w+$/.test(body.channel || "") ? body.channel : "mail";
    return json(await sendDigest(env, { force: true, test: true, channel: ch }));
  }
  if (p === "/weekly/send" && m === "POST") return json(await sendWeekly(env, { test: !!body.test }));
  if (p === "/sources/health" && m === "GET") {
    const since = dayOf(Date.now() - 6 * 864e5);
    const { results } = await env.DB.prepare("SELECT name, SUM(fetched) AS fetched, SUM(added) AS added, SUM(errors) AS errors, MAX(last_at) AS last_at, COUNT(*) AS days FROM src_health WHERE day >= ? GROUP BY name").bind(since).all();
    const { results: errs } = await env.DB.prepare("SELECT name, last_err FROM src_health WHERE day >= ? AND last_err IS NOT NULL ORDER BY day DESC").bind(since).all();
    const out = {};
    for (const r of results || []) out[r.name] = { fetched: r.fetched || 0, added: r.added || 0, errors: r.errors || 0, last_at: r.last_at || null };
    for (const r of errs || []) if (out[r.name] && !out[r.name].last_err) out[r.name].last_err = r.last_err;
    return json(out);
  }
  if (p === "/export" && m === "GET") {
    const s = await getSettings(env);
    const withSecrets = url.searchParams.get("secrets") === "1";
    const out = {};
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (k === "mail_last_sent_at") continue;
      if (SECRET_KEYS.includes(k) && !withSecrets) continue;
      if (s[k] !== DEFAULT_SETTINGS[k] || k === "sources") out[k] = s[k];
    }
    return new Response(JSON.stringify({ app: "free-resource-radar", version: 1, exported_at: (/* @__PURE__ */ new Date()).toISOString(), secrets: withSecrets, settings: out }, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="free-resource-radar-${dayOf(Date.now())}.json"` } });
  }
  if (p === "/import" && m === "POST") {
    const src = body && body.settings && typeof body.settings === "object" ? body.settings : null;
    if (!src || body.app !== "free-resource-radar") return json({ error: "\u4E0D\u662F\u672C\u9879\u76EE\u5BFC\u51FA\u7684\u5907\u4EFD\u6587\u4EF6" }, 400);
    const patch = {};
    for (const [k, v] of Object.entries(src)) if (k in DEFAULT_SETTINGS && k !== "mail_last_sent_at") patch[k] = String(v ?? "");
    try {
      await saveSettings(env, patch);
    } catch (e) {
      return json({ error: "\u5BFC\u5165\u5931\u8D25\uFF1A" + e.message }, 400);
    }
    return json({ ok: true, count: Object.keys(patch).length, settings: settingsForAdmin(await getSettings(env)) });
  }
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
<div class="b"><h1>\u90E8\u7F72\u6210\u529F\uFF0C\u8FD8\u5DEE\u4E00\u6B65</h1><p>\u5728 Cloudflare \u63A7\u5236\u53F0\u6253\u5F00\u8FD9\u4E2A Worker\uFF0C\u8865\u4E0A\u4EE5\u4E0B\u7ED1\u5B9A\u540E\u5237\u65B0\u672C\u9875\u3002\u6570\u636E\u8868\u4F1A\u81EA\u52A8\u521B\u5EFA\uFF0C\u7BA1\u7406\u5458\u5BC6\u7801\u5728\u9996\u6B21\u6253\u5F00 /admin \u65F6\u8BBE\u7F6E\u3002</p><ol>${rows}</ol><p>\u5B9A\u65F6\u6293\u53D6\uFF1A\u8BBE\u7F6E \u2192 \u89E6\u53D1\u4E8B\u4EF6 \u2192 \u6DFB\u52A0 Cron\uFF0C\u586B <code>* * * * *</code>\uFF08\u6BCF\u5206\u949F\u4E00\u6B21\uFF0C\u6293\u53D6\u65F6\u95F4\u5728\u540E\u53F0\u8BBE\u7F6E\uFF09\u3002\u7528\u4E00\u952E\u90E8\u7F72\u7684\u8BDD\u5DF2\u81EA\u52A8\u914D\u7F6E\u3002</p></div></html>`, 503);
}
var SITE_COOKIE = "frr_site";
var siteHash = (env) => memo("sitehash", 3e5, () => getSitePassHash(env));
async function siteGate(req, env, url) {
  const h = await siteHash(env);
  if (!h) return { ok: true };
  const token = await sha256("cookie:" + h);
  const cookie = (req.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(SITE_COOKIE + "="));
  if (cookie && safeEqual(cookie.slice(SITE_COOKIE.length + 1), token)) return { ok: true };
  const key = url.searchParams.get("key");
  if (key && safeEqual(await sha256("frr-site:" + key), h)) return { ok: true };
  return { ok: false, token, hash: h };
}
var lockPage = () => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#f6f7f9;color:#111318}
.b{width:min(340px,90vw);background:#fff;border:1px solid #e6e8ec;border-radius:10px;padding:26px}h1{font-size:16px;margin:0 0 4px}p{margin:0 0 16px;color:#646f80;font-size:13px}
input{width:100%;box-sizing:border-box;height:38px;border:1px solid #e6e8ec;border-radius:7px;padding:0 12px;font:inherit;background:transparent;color:inherit}button{margin-top:12px;width:100%;height:38px;border:0;border-radius:7px;background:#111318;color:#fff;font:inherit;cursor:pointer}
.e{color:#b91c1c;font-size:12px;min-height:18px;margin-top:8px}@media(prefers-color-scheme:dark){body{background:#0d0f13;color:#eef0f4}.b{background:#121419;border-color:#252932}input{border-color:#252932}button{background:#eef0f4;color:#0d0f13}}</style></head>
<body><form class="b" onsubmit="go(event)"><h1>\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE</h1><p>\u8BF7\u8F93\u5165\u8BBF\u95EE\u5BC6\u7801</p><input type="password" id="p" autofocus autocomplete="current-password" placeholder="\u8BBF\u95EE\u5BC6\u7801"><button>\u8FDB\u5165</button><div class="e" id="e"></div></form>
<script>async function go(e){e.preventDefault();const r=await fetch('/api/site-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:document.getElementById('p').value})});if(r.ok)location.reload();else document.getElementById('e').textContent='\u5BC6\u7801\u4E0D\u5BF9';}</script></body></html>`;
var index_default = {
  async fetch(req, env, ctx) {
    try {
      return await handleFetch(req, env, ctx);
    } catch (e) {
      return errorPage(e, new URL(req.url).pathname);
    }
  },
  async scheduled(event, env, ctx) {
    try {
      await handleScheduled(event, env, ctx);
    } catch (e) {
      console.error("scheduled failed", e && (e.stack || e.message || e));
    }
  }
};
function errorPage(e, path) {
  const msg = String(e && (e.stack || e.message) || e).slice(0, 1500);
  console.error("request failed", path, msg);
  if (path.startsWith("/api/")) return json({ error: msg }, 500);
  const quota = /limit|exceed|quota|too many/i.test(msg);
  return html(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>\u6682\u65F6\u6253\u4E0D\u5F00 \xB7 \u514D\u8D39\u8D44\u6E90\u96F7\u8FBE</title>
<style>body{margin:0;background:#f6f7f9;font:14px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#111318}.b{max-width:640px;margin:10vh auto;background:#fff;border:1px solid #e6e8ec;border-radius:8px;padding:24px 28px}h1{font-size:17px;margin:0 0 6px}p{color:#525c6b}pre{background:#f1f3f6;padding:10px;border-radius:6px;white-space:pre-wrap;word-break:break-all;font-size:12px}</style>
<div class="b"><h1>\u9875\u9762\u6682\u65F6\u6253\u4E0D\u5F00</h1><p>${quota ? "\u770B\u8D77\u6765\u662F Cloudflare \u514D\u8D39\u989D\u5EA6\uFF08D1 \u8BFB\u5199\u6B21\u6570\u6216\u8BF7\u6C42\u6570\uFF09\u4ECA\u5929\u7528\u5B8C\u4E86\uFF0C\u5317\u4EAC\u65F6\u95F4 08:00 \u91CD\u7F6E\u3002" : "\u7A0B\u5E8F\u51FA\u9519\u4E86\uFF0C\u628A\u4E0B\u9762\u8FD9\u6BB5\u53D1\u7ED9\u7EF4\u62A4\u8005\u5373\u53EF\u5B9A\u4F4D\u3002"}</p><pre>${msg.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c])}</pre><p>\u8BCA\u65AD\uFF1A\u6253\u5F00 <a href="/api/health">/api/health</a> \u67E5\u770B\u5404\u9879\u68C0\u67E5\u3002</p></div></html>`, 500);
}
async function health(env) {
  const out = {};
  const step = async (k, fn) => {
    const t = Date.now();
    try {
      out[k] = { ok: true, ms: Date.now() - t, ...await fn() };
      out[k].ms = Date.now() - t;
    } catch (e) {
      out[k] = { ok: false, error: String(e && e.message || e).slice(0, 300) };
    }
  };
  await step("d1", async () => ({ v: (await env.DB.prepare("SELECT 1 AS x").first())?.x }));
  await step("schema", async () => {
    await ensureSchema(env);
    return {};
  });
  await step("items", async () => ({ n: (await env.DB.prepare("SELECT COUNT(*) AS n FROM items WHERE status = 'approved'").first())?.n }));
  await step("snapshot", async () => {
    const r = await readSnap(env, "head");
    return { ver: r?.ver || null, bytes: r?.v ? r.v.length : 0 };
  });
  await step("settings", async () => {
    const s = await getBasicSettings(env);
    return { keys: Object.keys(s).length };
  });
  await step("kv", async () => ({ bound: !!env.SECRETS }));
  await step("run", async () => {
    const r = await env.DB.prepare("SELECT id, started_at, finished_at FROM runs ORDER BY id DESC LIMIT 1").first();
    return { last: r || null };
  });
  return { ok: Object.values(out).every((x) => x.ok), version: "1.8.2", checks: out };
}
async function handleFetch(req, env, ctx) {
  const url = new URL(req.url);
  const missing = setupMissing(env);
  if (missing.length) return setupPage(missing, url.pathname.startsWith("/api/"));
  if (url.pathname === "/api/health") return json(await health(env));
  try {
    await ensureSchema(env);
    const ip = ipOf(req);
    if (url.pathname === "/api/site-login" && req.method === "POST") {
      const h = await getSitePassHash(env);
      const { password } = await req.json().catch(() => ({}));
      if (!h) return json({ ok: true });
      if (await failsOf(env, ip) >= (Number((await basic(env)).login_max_fails) || 10)) return tooMany();
      if (!password || !safeEqual(await sha256("frr-site:" + password), h)) {
        await addFail(env, ip);
        return json({ error: "\u5BC6\u7801\u9519\u8BEF" }, 401);
      }
      const token = await sha256("cookie:" + h);
      return new Response('{"ok":true}', { headers: { "content-type": "application/json", "set-cookie": `${SITE_COOKIE}=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax` } });
    }
    if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/admin/") && url.pathname !== "/api/cron") {
      const lim = Number((await basic(env)).api_rate_per_min);
      if (!rateOk("api:" + ip, Number.isFinite(lim) ? lim : 120) || url.pathname === "/api/vote" && !rateOk("vote:" + ip, 30)) return json({ error: "\u8BF7\u6C42\u592A\u9891\u7E41\uFF0C\u7A0D\u540E\u518D\u8BD5" }, 429);
    }
    if (["/", "/index.html", "/api/items", "/api/stats", "/feed.xml", "/api/data", "/api/vote"].includes(url.pathname)) {
      const g = await siteGate(req, env, url);
      if (!g.ok) return url.pathname.startsWith("/api/") || url.pathname === "/feed.xml" ? json({ error: "\u9700\u8981\u8BBF\u95EE\u5BC6\u7801" }, 401) : html(lockPage(), 401);
    }
    if (url.pathname === "/api/vote" && req.method === "POST") {
      const r = await vote(req, env);
      ctx.waitUntil(markDirty(env));
      return r;
    }
    if (url.pathname === "/api/data") {
      const JS = "application/json; charset=utf-8";
      const edge = !await siteHash(env) && typeof caches !== "undefined" && caches.default;
      if (edge) {
        const ck = new Request(url.origin + url.pathname + url.search, { method: "GET" });
        const hit = await caches.default.match(ck).catch(() => null);
        if (hit) return hit;
        const res = await dataResp(req, url, env, JS);
        if (res.status === 200) {
          const c = res.clone();
          const h = new Headers(c.headers);
          h.set("cache-control", "public, max-age=120");
          ctx.waitUntil(caches.default.put(ck, new Response(c.body, { headers: h })).catch(() => {
          }));
        }
        return res;
      }
      return dataResp(req, url, env, JS);
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      maybeVisitTick(env, ctx);
      if (!await siteHash(env)) return new Response(STATIC_PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
      const d = await pageData(env, "head");
      return sendSnap(req, d, "text/html; charset=utf-8", PAGE_A + d.v + PAGE_B);
    }
    if (url.pathname === "/api/cron") {
      const key = url.searchParams.get("key") || req.headers.get("x-cron-key") || "";
      if (!key || !safeEqual(key, await memo("cronkey", 6e4, () => getCronKey(env)))) return json({ error: "\u89E6\u53D1\u5BC6\u94A5\u4E0D\u5BF9" }, 403);
      return json(await triggerTick(env, "url"));
    }
    if (url.pathname === "/admin" || url.pathname === "/admin/") return html(admin_default.replace("/*__CATS__*/[]", JSON.stringify(CATEGORIES.map(({ key, label, color, kw, group, info }) => ({ key, label, color, group, info: !!info, kw: kw.slice(0, 6) })))).replace("/*__GROUPS__*/[]", JSON.stringify(GROUPS)).replace("/*__PUSH__*/[]", JSON.stringify(PUSH_CHANNELS.map(({ id, name, key, secret, hint }) => ({ id, name, key, secret, hint })))).replace("/*__BACKENDS__*/[]", JSON.stringify(BACKENDS.map(({ id, name, keyless, free, signup, note, zh }) => ({ id, name, keyless, free, signup, note, zh })))));
    if (url.pathname === "/api/items") return json(await publicItems(env, url));
    if (url.pathname === "/api/stats") {
      const st = await basic(env);
      const cutoff = Date.now() - (Number(st.max_age_days) || 180) * 864e5;
      const base = "FROM items WHERE status = 'approved' AND (published_at IS NULL OR published_at >= ?)";
      const [cats, obs, last, days] = await Promise.all([
        env.DB.prepare(`SELECT category AS k, COUNT(*) AS n ${base} GROUP BY category`).bind(cutoff).all(),
        env.DB.prepare(`SELECT obtain AS k, COUNT(*) AS n ${base} GROUP BY obtain`).bind(cutoff).all(),
        env.DB.prepare("SELECT MAX(finished_at) AS t FROM runs WHERE trigger != 'mail'").first(),
        env.DB.prepare(`SELECT day AS d, COUNT(*) AS n ${base} AND day IS NOT NULL GROUP BY day ORDER BY day DESC LIMIT 31`).bind(cutoff).all()
      ]);
      const out = { all: 0, last_run: last?.t || null, categories: enabledCats(st).map((k) => ({ key: k, label: CAT_MAP[k].label, color: CAT_MAP[k].color })), today: dayOf(Date.now()), retention_days: Number(st.retention_days) || 15, days: (days.results || []).map((r) => ({ day: r.d, n: r.n })) };
      for (const r of cats.results || []) {
        out[r.k || "other"] = r.n;
        out.all += r.n;
      }
      for (const r of obs.results || []) if (r.k) out[r.k] = r.n;
      return json(out);
    }
    if (url.pathname === "/feed.xml") {
      const st = await basic(env);
      const items = await memo("feed", Math.max(0, Number(st.public_cache_seconds) || 0) * 1e3, () => publicItems(env, new URL(url.origin + "/?limit=50")));
      const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>\u514D\u8D39\u8D44\u6E90\u96F7\u8FBE</title><link>${xmlEsc(url.origin)}</link><description>\u6BCF\u65E5\u81EA\u52A8\u6293\u53D6\u5E76\u7ECF AI \u7B5B\u9009</description>${items.map((it) => `<item><title>${xmlEsc(it.name || it.title)}</title><link>${xmlEsc(it.url)}</link><guid isPermaLink="false">${it.id}</guid>${it.published_at ? `<pubDate>${new Date(it.published_at).toUTCString()}</pubDate>` : ""}<description>${xmlEsc([it.summary, it.signup && "\u6CE8\u518C\uFF1A" + it.signup].filter(Boolean).join(" | "))}</description></item>`).join("")}</channel></rss>`;
      return cached(req, body, "application/rss+xml; charset=utf-8");
    }
    if (url.pathname.startsWith("/api/admin/")) {
      if (url.pathname === "/api/admin/status") {
        return json({ initialized: !!envToken(env) || !!await getAdminHash(env), env_token: !!envToken(env), storage: storageMode(env), site_locked: !!await getSitePassHash(env) });
      }
      if (url.pathname === "/api/admin/setup" && req.method === "POST") {
        if (envToken(env) || await getAdminHash(env)) return json({ error: "\u5DF2\u7ECF\u8BBE\u7F6E\u8FC7\u7BA1\u7406\u5458\u5BC6\u7801" }, 409);
        const { password } = await req.json().catch(() => ({}));
        if (!password || String(password).length < 8) return json({ error: "\u5BC6\u7801\u81F3\u5C11 8 \u4F4D" }, 400);
        await setAdminHash(env, String(password));
        return json({ ok: true });
      }
      const maxFails = Number((await basic(env)).login_max_fails) || 10;
      if (await failsOf(env, ip) >= maxFails) return tooMany();
      if (!await isAdmin(req, env)) {
        if (req.headers.get("authorization")) await addFail(env, ip);
        return json({ error: "\u672A\u6388\u6743" }, 401);
      }
      if (req.method !== "GET" && url.pathname !== "/api/admin/snap") {
        clearMemo();
        ctx.waitUntil(markDirty(env));
      }
      if (url.pathname === "/api/admin/password" && req.method === "POST") {
        if (envToken(env)) return json({ error: "\u5F53\u524D\u4F7F\u7528\u73AF\u5883\u53D8\u91CF ADMIN_TOKEN\uFF0C\u8BF7\u5728 Cloudflare \u63A7\u5236\u53F0\u4FEE\u6539" }, 400);
        const { password } = await req.json().catch(() => ({}));
        if (!password || String(password).length < 8) return json({ error: "\u5BC6\u7801\u81F3\u5C11 8 \u4F4D" }, 400);
        await setAdminHash(env, String(password));
        return json({ ok: true });
      }
      if (url.pathname === "/api/admin/settings" && req.method === "GET" && !/^(localhost|127\.|\[::1\])/.test(url.hostname)) {
        const cur = await getSettings(env);
        if (!cur.mail_site_url) await saveSettings(env, { mail_site_url: url.origin });
      }
      return await handleAdmin(req, env, url);
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return errorPage(e, url.pathname);
  }
}
async function handleScheduled(event, env, ctx) {
  const missing = setupMissing(env);
  if (missing.length) {
    console.error("\u90E8\u7F72\u672A\u5B8C\u6210\uFF0C\u7F3A\u5C11\u7ED1\u5B9A\uFF1A" + missing.map((x) => x[0]).join(", "));
    return;
  }
  await ensureSchema(env);
  ctx.waitUntil(autoTick(env, "cron").catch((e) => console.error("scheduled failed", e)));
}
async function snapDue(env, idle) {
  const [b, dirty, at, ver] = await Promise.all(["snap_build", "snap_dirty", "snap_at", "snap_ver"].map((k) => getMeta(env, k)));
  if (b || !ver) return true;
  if (!(Number(dirty) > Number(at))) return idle && Date.now() - Number(at) > 6 * 36e5;
  return idle || Date.now() - Number(at) > 10 * 6e4;
}
async function autoTick(env, trigger) {
  if (await snapDue(env, false)) {
    const sr = await snapStep(env);
    if (sr) {
      clearMemo();
      return { idle: false, action: "snap", message: `\u8D44\u6E90\u9875\u5FEB\u7167 ${sr.step} / ${sr.total}`, ...sr };
    }
  }
  const s = await getSettings(env);
  const steps = Math.min(50, Math.max(1, Number(s.steps_per_tick) || 1));
  const r = await tick(env, steps);
  if (!r.idle) {
    await markDirty(env);
    clearMemo();
    return { ...r, action: "step" };
  }
  if (await snapDue(env, true)) {
    const sr = await snapStep(env);
    if (sr) {
      clearMemo();
      return { idle: true, action: "snap", message: `\u8D44\u6E90\u9875\u5FEB\u7167 ${sr.step} / ${sr.total}`, ...sr };
    }
  }
  const now = Date.now();
  const every = Math.min(24, Math.max(1, Number(s.crawl_every_hours) || 24));
  const crawlSlot = latestSlot(now, slotHours(Number(s.run_hour) || 0, every));
  const ran = await env.DB.prepare("SELECT id FROM runs WHERE trigger IN ('cron', 'url', 'visit') AND started_at >= ? LIMIT 1").bind(crawlSlot).first();
  if (ran) {
    const mailSlot = latestSlot(now, parseHours(s.mail_hours));
    if (mailSlot && now - mailSlot < 3 * 36e5 && Number(await getMeta(env, "mail_slot")) < mailSlot) {
      await setMeta(env, "mail_slot", mailSlot);
      const h = new Date(mailSlot + 8 * 36e5).getUTCHours();
      const label = h < 11 ? "\u65E9\u62A5" : h < 17 ? "\u5348\u62A5" : "\u665A\u62A5";
      const t0 = Date.now();
      let line2;
      try {
        const r2 = await sendDigest(env, { label });
        line2 = r2.skipped ? `\u2013 ${label}\u8DF3\u8FC7\uFF1A${r2.skipped}` : `\u2713 ${label}\u5DF2\u63A8\u9001 ${r2.sent} \u6761\uFF08${r2.providers.join(" + ")}\uFF09\u2192 ${r2.to.join(", ")}${r2.errors.length ? "\n\u2717 " + r2.errors.join("\n\u2717 ") : ""}`;
      } catch (e) {
        line2 = `\u2717 ${label}\u63A8\u9001\u5931\u8D25\uFF1A${e.message}`;
      }
      const bjNow = new Date(now + BJ2);
      if (s.weekly_enabled === "true" && bjNow.getUTCDay() === (Number(s.weekly_weekday) || 0) % 7 && await getMeta(env, "weekly_day") !== dayOf(now)) {
        await setMeta(env, "weekly_day", dayOf(now));
        try {
          const w = await sendWeekly(env);
          line2 += w.skipped ? `
\u2013 \u672C\u5468\u7CBE\u9009\u8DF3\u8FC7\uFF1A${w.skipped}` : `
\u2713 \u672C\u5468\u7CBE\u9009\u5DF2\u63A8\u9001 ${w.sent} \u6761\uFF08${w.providers.join(" + ")}\uFF09`;
        } catch (e) {
          line2 += `
\u2717 \u672C\u5468\u7CBE\u9009\u63A8\u9001\u5931\u8D25\uFF1A${e.message}`;
        }
      }
      if (!line2.includes("\u6CA1\u6709\u53EF\u7528\u7684\u63A8\u9001\u6E20\u9053")) await env.DB.prepare("INSERT INTO runs (trigger, started_at, finished_at, stats, log) VALUES ('mail', ?, ?, '{}', ?)").bind(t0, Date.now(), line2).run();
      return { idle: true, action: "mail", message: line2 };
    }
    return { idle: true, action: "wait", message: "\u8FD9\u4E00\u8F6E\u5DF2\u7ECF\u6293\u53D6\u8FC7\u4E86\uFF0C\u4E0B\u4E00\u8F6E\uFF1A" + nextSlotText(now, slotHours(Number(s.run_hour) || 0, every)) };
  }
  const plan = await planRun(env, trigger);
  return { idle: false, action: "started", run_id: plan.run_id, steps: plan.steps, message: `\u5DF2\u5F00\u59CB\u65B0\u4E00\u8F6E\u6293\u53D6\uFF0C\u5171 ${plan.steps} \u6B65` };
}
var BJ2 = 8 * 36e5;
var parseHours = (v) => [...new Set(String(v || "").split(/[,，\s]+/).map(Number).filter((h) => Number.isInteger(h) && h >= 0 && h <= 23))].sort((a, b) => a - b);
function slotHours(start, every) {
  const out = [];
  for (let k = 0; k * every < 24; k++) out.push((start + k * every) % 24);
  return [...new Set(out)].sort((a, b) => a - b);
}
function latestSlot(now, hours) {
  if (!hours.length) return 0;
  const day0 = Date.parse(dayOf(now) + "T00:00:00+08:00");
  const h = new Date(now + BJ2).getUTCHours();
  const past = hours.filter((x) => x <= h);
  return past.length ? day0 + past[past.length - 1] * 36e5 : day0 - 864e5 + hours[hours.length - 1] * 36e5;
}
function nextSlotText(now, hours) {
  const h = new Date(now + BJ2).getUTCHours();
  const n = hours.find((x) => x > h);
  return n === void 0 ? `\u660E\u5929 ${hours[0]}:00` : `${n}:00`;
}
var lastTrigger = 0;
async function triggerTick(env, trigger) {
  const s = await basic(env);
  const gap = Math.max(5, Number(s.trigger_min_seconds) || 30) * 1e3;
  const now = Date.now();
  if (now - lastTrigger < gap) return { ok: true, throttled: true, retry_after: Math.ceil((gap - (now - lastTrigger)) / 1e3) };
  const last = Number(await getMeta(env, "trigger_last")) || 0;
  if (now - last < gap) {
    lastTrigger = last;
    return { ok: true, throttled: true, retry_after: Math.ceil((gap - (now - last)) / 1e3) };
  }
  lastTrigger = now;
  await setMeta(env, "trigger_last", now);
  const r = await autoTick(env, trigger);
  return { ok: true, action: r.action, message: r.message, current: r.current, done: r.done, left: r.left, total: r.total, run_id: r.run_id };
}
function maybeVisitTick(env, ctx) {
  if (Date.now() - lastTrigger < 5e3) return;
  ctx.waitUntil((async () => {
    const s = await basic(env);
    if (s.visit_trigger !== "true") return;
    await triggerTick(env, "visit");
  })().catch((e) => console.error("visit tick failed", e)));
}
export {
  index_default as default
};
