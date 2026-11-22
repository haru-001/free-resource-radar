import { ensureSchema, getSettings, getBasicSettings, saveSettings, settingsForAdmin, storageMode, getAdminHash, setAdminHash, sha256, dayOf, getSitePassHash, setSitePass, getMeta, setMeta, getCronKey, DEFAULT_SETTINGS, SECRET_KEYS } from './db.js';
import { listModels, chat } from './ai.js';
import { planRun, tick } from './crawler.js';
import { sendDigest, previewDigest, sendWeekly } from './mailer.js';
import { PUSH_CHANNELS } from './push.js';
import { weeklyPicks, perksOf, checkinOf } from './extras.js';
import { BACKENDS, BACKEND_MAP, runBackend, searchForDiscovery } from './search.js';
import { checkSources, probeInputs, discoverSources } from './sources-sync.js';
import { foldItems } from './fold.js';
import { readSnap, liveHead, livePart, liveOld, markDirty, snapStep } from './snap.js';
import { CATEGORIES, CAT_MAP, GROUPS, enabledCats } from './categories.js';
import adminHtml from './admin.html';
import publicHtml from './public.html';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const html = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
// 部署时没改默认值的 ADMIN_TOKEN 视为未设置，改用后台首次设置的密码
const envToken = (env) => { const t = String(env.ADMIN_TOKEN || '').trim(); return t && t !== 'change-me' ? t : ''; };

// 鉴权：优先用环境变量 ADMIN_TOKEN；没设置时用首次打开后台时设置的密码（哈希存 D1）
async function isAdmin(req, env) {
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!got) return false;
  if (envToken(env)) return safeEqual(got, envToken(env));
  const h = await getAdminHash(env);
  return !!h && safeEqual(await sha256('frr:' + got), h);
}

// 后台请求里如果 key 是打码值或为空，则使用已保存的
function resolveAi(target, body, s) {
  const key = body.api_key && !String(body.api_key).includes('****') ? body.api_key : s.ai_api_key;
  return { baseUrl: body.base_url || s.ai_base_url, apiKey: key, model: body.model || s.ai_model, extra: '{}' };
}

// ---------- 缓存：同一个 Worker 实例内存缓存公开数据，缓存期内不查数据库 ----------
const MEMO = new Map();
async function memo(key, ttlMs, fn) {
  const hit = MEMO.get(key);
  if (hit && hit.exp > Date.now()) return hit.v;
  const v = await fn();
  MEMO.set(key, { v, exp: Date.now() + ttlMs });
  return v;
}
const clearMemo = () => MEMO.clear();
const etagOf = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i += 7) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return `W/"${(h >>> 0).toString(36)}-${s.length.toString(36)}"`; };
function cached(req, body, type, extra = {}) {
  const etag = etagOf(body);
  const headers = { 'content-type': type, etag, 'cache-control': 'no-cache', ...extra };
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { headers });
}
const basic = (env) => memo('basic', 15000, () => getBasicSettings(env));

// 资源页数据：读定时任务预先生成的快照（snap.js），访问时只读一行 + 拼接字符串，不现算
const [PAGE_A, PAGE_B] = publicHtml.split('/*__BOOT__*/null');
const STATIC_PAGE = PAGE_A + 'null' + PAGE_B;
async function dataResp(req, url, env, JS) {
  if (url.searchParams.get('old') === '1') return sendSnap(req, await pageData(env, 'old'), JS);
  const part = Number(url.searchParams.get('part')) || 0;
  if (part > 0) return sendSnap(req, await pageData(env, 'part:' + Math.min(part, 50)), JS);
  return sendSnap(req, await pageData(env, 'head'), JS);
}
async function snapOrLive(env, part) {
  const r = await readSnap(env, part);
  if (r && r.v) return { v: r.v, tag: r.ver + ':' + part };
  // 还没有快照（刚部署或刚升级）：现算一个限量版本，并标记需要生成
  markDirty(env);
  const v = part === 'head' ? await liveHead(env) : part === 'old' ? await liveOld(env) : await livePart(env, Number(part.split(':')[1]) || 1);
  return { v, tag: 'live:' + part + ':' + Math.floor(Date.now() / 60000) };
}
const pageData = (env, part) => memo('snap:' + part, 20000, () => snapOrLive(env, part));
function sendSnap(req, d, type, body) {
  const etag = `W/"${d.tag}"`;
  const headers = { 'content-type': type, etag, 'cache-control': 'no-cache' };
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  return new Response(body ?? d.v, { headers });
}

// ---------- 频率限制：公开接口按 IP 每分钟限次（单个实例内存计数，够挡住脚本乱刷）；登录失败计数存 D1 ----------
const RL = new Map();
function rateOk(key, limit, windowMs = 60000) {
  if (!limit) return true;
  const now = Date.now();
  let e = RL.get(key);
  if (!e || e.reset < now) { if (RL.size > 5000) RL.clear(); e = { n: 0, reset: now + windowMs }; RL.set(key, e); }
  return ++e.n <= limit;
}
const ipOf = (req) => req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'local';
const FAIL_WINDOW = 15 * 60000;
async function failsOf(env, ip) {
  const r = await env.DB.prepare('SELECT n, reset FROM rate WHERE k = ?').bind('login:' + ip).first();
  return r && r.reset > Date.now() ? r.n : 0;
}
function addFail(env, ip) {
  const now = Date.now();
  return env.DB.prepare('INSERT INTO rate (k, n, reset) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN rate.reset < ? THEN 1 ELSE rate.n + 1 END, reset = CASE WHEN rate.reset < ? THEN excluded.reset ELSE rate.reset END')
    .bind('login:' + ip, now + FAIL_WINDOW, now, now).run().catch(() => {});
}
const tooMany = () => json({ error: '密码错误次数太多，请 15 分钟后再试' }, 429);

// ---------- 值 / 不值 投票 ----------
async function vote(req, env) {
  const { id, v } = await req.json().catch(() => ({}));
  const val = Number(v);
  if (!/^[0-9a-f]{40}$/.test(String(id || '')) || ![1, -1, 0].includes(val)) return json({ error: '参数不对' }, 400);
  const voter = (await sha256('vote:' + ipOf(req))).slice(0, 24);
  const prev = await env.DB.prepare('SELECT v FROM votes WHERE id = ? AND voter = ?').bind(id, voter).first();
  const pv = prev?.v || 0;
  if (pv === val) { const r = await env.DB.prepare('SELECT up, down FROM items WHERE id = ?').bind(id).first(); return json({ ok: true, up: r?.up || 0, down: r?.down || 0, mine: val }); }
  const du = (val === 1) - (pv === 1), dd = (val === -1) - (pv === -1);
  await env.DB.batch([
    val ? env.DB.prepare('INSERT INTO votes (id, voter, v, at) VALUES (?, ?, ?, ?) ON CONFLICT(id, voter) DO UPDATE SET v = excluded.v, at = excluded.at').bind(id, voter, val, Date.now())
      : env.DB.prepare('DELETE FROM votes WHERE id = ? AND voter = ?').bind(id, voter),
    env.DB.prepare('UPDATE items SET up = MAX(0, up + ?), down = MAX(0, down + ?) WHERE id = ?').bind(du, dd, id),
  ]);
  const r = await env.DB.prepare('SELECT up, down FROM items WHERE id = ?').bind(id).first();
  const st = await basic(env);
  const hide = Number(st.vote_hide) || 0;
  if (r && hide > 0 && r.down - r.up >= hide) await env.DB.prepare("UPDATE items SET status = 'rejected', judged_by = 'votes', judged_at = ? WHERE id = ?").bind(Date.now(), id).run();
  return json({ ok: true, up: r?.up || 0, down: r?.down || 0, mine: val });
}

async function publicItems(env, url) {
  const s = await basic(env);
  const cutoff = Date.now() - (Number(s.max_age_days) || 180) * 86400000;
  const where = ["status = 'approved'", 'dead = 0', '(published_at IS NULL OR published_at >= ?)'];
  const args = [cutoff];
  const ob = url.searchParams.get('obtain');
  if (ob) { where.push('obtain = ?'); args.push(ob); }
  const cat = url.searchParams.get('category');
  if (cat) { where.push('category = ?'); args.push(cat); }
  const day = url.searchParams.get('day');
  if (day) { where.push('day = ?'); args.push(day); }
  const q = url.searchParams.get('q');
  if (q) { where.push('(title LIKE ? OR summary LIKE ? OR name LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const limit = Math.min(200, Number(url.searchParams.get('limit')) || 100);
  const { results } = await env.DB.prepare(
    `SELECT id, title, url, source, published_at, fetched_at, day, category, name, summary, signup, score, obtain FROM items WHERE ${where.join(' AND ')} ORDER BY day DESC, score DESC, published_at DESC LIMIT ?`
  ).bind(...args, limit).all();
  return results || [];
}

const xmlEsc = (s) => String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);

async function handleAdmin(req, env, url) {
  const p = url.pathname.replace('/api/admin', '');
  const m = req.method;
  const body = m === 'GET' || m === 'DELETE' ? {} : await req.json().catch(() => ({}));

  // 生成资源页快照（后台「立即抓取」结束后由浏览器逐步调用，每次一步）
  if (p === '/snap' && m === 'POST') { const r = await snapStep(env, !!body.force); clearMemo(); return json(r || { done: true, idle: true }); }
  if (p === '/settings' && m === 'GET') return json(settingsForAdmin(await getSettings(env)));
  if (p === '/settings' && m === 'PUT') {
    try { await saveSettings(env, body); } catch (e) { return json({ error: `保存失败：${e.message}` }, 400); }
    return json({ ok: true, settings: settingsForAdmin(await getSettings(env)) });
  }
  if (p === '/models' && m === 'POST') {
    const s = await getSettings(env);
    const c = resolveAi(body.target, body, s);
    if (!c.baseUrl || !c.apiKey) return json({ error: '请先填写接口地址和 Key' }, 400);
    return json({ models: await listModels(c.baseUrl, c.apiKey) });
  }
  if (p === '/test' && m === 'POST') {
    const s = await getSettings(env);
    const c = resolveAi(body.target, body, s);
    let extra = {};
    try { extra = JSON.parse(c.extra || '{}'); } catch {}
    const t0 = Date.now();
    const reply = await chat({ baseUrl: c.baseUrl, apiKey: c.apiKey, model: c.model, extra, messages: [{ role: 'user', content: '只回复 OK' }], timeout: 60000 });
    return json({ ok: true, reply: reply.slice(0, 200), ms: Date.now() - t0 });
  }
  // 立即抓取：建好步骤后由浏览器循环调用 /step，每次一步（每次都是独立调用，不会超出免费版 CPU 限制）
  if (p === '/run' && m === 'POST') return json(await planRun(env, 'manual'));
  // 用 AI 重新判定：把关键词判定过的条目重置为待判定，只跑判定步骤
  if (p === '/rejudge' && m === 'POST') {
    const s = await getSettings(env);
    if (!(s.ai_enabled !== 'false' && s.ai_api_key && s.ai_base_url && s.ai_model)) return json({ error: '请先填好 AI 接口地址、Key 和模型并保存' }, 400);
    const r = await env.DB.prepare("UPDATE items SET status = 'pending', attempts = 0 WHERE judged_by = 'keywords' OR (status = 'rejected' AND judged_by IS NULL)").run();
    const plan = await planRun(env, 'rejudge', { only: 'judge', cap: 300 });
    return json({ ...plan, reset: r.meta?.changes || 0 });
  }
  if (p === '/site-password' && m === 'POST') {
    await setSitePass(env, String(body.password || '').trim());
    return json({ ok: true, locked: !!String(body.password || '').trim() });
  }
  if (p === '/step' && m === 'POST') return json(await tick(env, Math.min(5, Math.max(1, Number(body.n) || 1))));
  if (p === '/cron-key' && m === 'GET') return json({ key: await getCronKey(env), last: Number(await getMeta(env, 'trigger_last')) || 0 });
  if (p === '/cron-key' && m === 'POST') return json({ key: await getCronKey(env, true) });
  if (p === '/search-test' && m === 'POST') {
    const s = await getSettings(env);
    if (!BACKEND_MAP[body.provider]) return json({ error: '未知搜索后端' }, 400);
    const t0 = Date.now();
    const r = await runBackend({ ...s, search_max_queries: '2' }, body.provider, Number(s.max_age_days) || 180);
    return json({ ok: true, ms: Date.now() - t0, count: r.items.length, errors: r.errors, sample: r.items.slice(0, 8).map((x) => ({ title: x.title, url: x.url, date: x.published_at ? new Date(x.published_at).toISOString().slice(0, 10) : null })) });
  }
  // 更新源：拉取内置推荐 + 远程源列表，返回当前还没有的（由后台勾选后合并、保存）
  if (p === '/sources/check' && m === 'POST') {
    const s = await getSettings(env);
    let current = [];
    try { current = JSON.parse(body.sources ?? s.sources); } catch {}
    const urls = String(body.urls ?? s.source_sync_urls ?? '').split(/\r?\n/).map((x) => x.trim()).filter((x) => /^https?:\/\//.test(x)).slice(0, 5);
    return json(await checkSources(Array.isArray(current) ? current : [], urls));
  }
  if ((p === '/sources/probe' || p === '/sources/discover') && m === 'POST') {
    const s = await getSettings(env);
    let current = [];
    try { current = JSON.parse(body.sources ?? s.sources); } catch {}
    if (!Array.isArray(current)) current = [];
    if (p === '/sources/probe') return json(await probeInputs(current, String(body.lines || '').split(/\r?\n/)));
    const kw = String(body.keyword || '').trim().slice(0, 40);
    if (!kw) return json({ error: '请输入关键词' }, 400);
    return json(await discoverSources(current, kw, (qs) => searchForDiscovery(s, qs)));
  }
  if (p === '/mail/test' && m === 'POST') {
    const ch = body.channel === 'telegram' || /^push:\w+$/.test(body.channel || '') ? body.channel : 'mail';
    return json(await sendDigest(env, { force: true, test: true, channel: ch }));
  }
  if (p === '/weekly/send' && m === 'POST') return json(await sendWeekly(env, { test: !!body.test }));
  // 来源健康：近 7 天每个源抓到多少、新增多少、失败几次
  if (p === '/sources/health' && m === 'GET') {
    const since = dayOf(Date.now() - 6 * 86400000);
    const { results } = await env.DB.prepare('SELECT name, SUM(fetched) AS fetched, SUM(added) AS added, SUM(errors) AS errors, MAX(last_at) AS last_at, COUNT(*) AS days FROM src_health WHERE day >= ? GROUP BY name').bind(since).all();
    const { results: errs } = await env.DB.prepare('SELECT name, last_err FROM src_health WHERE day >= ? AND last_err IS NOT NULL ORDER BY day DESC').bind(since).all();
    const out = {};
    for (const r of results || []) out[r.name] = { fetched: r.fetched || 0, added: r.added || 0, errors: r.errors || 0, last_at: r.last_at || null };
    for (const r of errs || []) if (out[r.name] && !out[r.name].last_err) out[r.name].last_err = r.last_err;
    return json(out);
  }
  // 备份与迁移：导出 / 导入全部设置（含数据源）。密钥默认不导出
  if (p === '/export' && m === 'GET') {
    const s = await getSettings(env);
    const withSecrets = url.searchParams.get('secrets') === '1';
    const out = {};
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (k === 'mail_last_sent_at') continue;
      if (SECRET_KEYS.includes(k) && !withSecrets) continue;
      if (s[k] !== DEFAULT_SETTINGS[k] || k === 'sources') out[k] = s[k];
    }
    return new Response(JSON.stringify({ app: 'free-resource-radar', version: 1, exported_at: new Date().toISOString(), secrets: withSecrets, settings: out }, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="free-resource-radar-${dayOf(Date.now())}.json"` } });
  }
  if (p === '/import' && m === 'POST') {
    const src = body && body.settings && typeof body.settings === 'object' ? body.settings : null;
    if (!src || body.app !== 'free-resource-radar') return json({ error: '不是本项目导出的备份文件' }, 400);
    const patch = {};
    for (const [k, v] of Object.entries(src)) if (k in DEFAULT_SETTINGS && k !== 'mail_last_sent_at') patch[k] = String(v ?? '');
    try { await saveSettings(env, patch); } catch (e) { return json({ error: '导入失败：' + e.message }, 400); }
    return json({ ok: true, count: Object.keys(patch).length, settings: settingsForAdmin(await getSettings(env)) });
  }
  if (p === '/mail/send' && m === 'POST') return json(await sendDigest(env, { force: true }));
  if (p === '/mail/preview' && m === 'GET') return html(await previewDigest(env));
  if (p === '/runs' && m === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 20').all();
    return json(results || []);
  }
  if (p === '/items' && m === 'GET') {
    const status = url.searchParams.get('status') || 'approved';
    const { results } = await env.DB.prepare('SELECT * FROM items WHERE status = ? ORDER BY published_at DESC LIMIT 300').bind(status).all();
    const { results: counts } = await env.DB.prepare('SELECT status, COUNT(*) AS n FROM items GROUP BY status').all();
    return json({ items: results || [], counts: Object.fromEntries((counts || []).map((r) => [r.status, r.n])) });
  }
  const im = p.match(/^\/items\/([0-9a-f]+)$/);
  if (im && m === 'POST') {
    if (!['approved', 'rejected', 'pending'].includes(body.status)) return json({ error: 'status 无效' }, 400);
    await env.DB.prepare('UPDATE items SET status = ?, judged_by = ?, judged_at = ?, attempts = 0 WHERE id = ?').bind(body.status, 'manual', Date.now(), im[1]).run();
    return json({ ok: true });
  }
  if (im && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM items WHERE id = ?').bind(im[1]).run();
    return json({ ok: true });
  }
  if (p === '/items' && m === 'DELETE') {
    const status = url.searchParams.get('status');
    if (!status) return json({ error: '需要 status' }, 400);
    await env.DB.prepare('DELETE FROM items WHERE status = ?').bind(status).run();
    return json({ ok: true });
  }
  return json({ error: 'Not found' }, 404);
}

// ---------- 部署自检：绑定缺失时给出中文指引，而不是报错 ----------
function setupMissing(env) {
  const m = [];
  if (!env.DB || typeof env.DB.prepare !== 'function') m.push(['DB', 'D1 数据库', 'Worker → 绑定 → 添加绑定 → D1 数据库，变量名填 DB，选择（或新建）一个数据库']);
  return m;
}
function setupPage(missing, asJson) {
  if (asJson) return json({ error: '部署未完成，缺少：' + missing.map((x) => x[0]).join(', ') }, 503);
  const rows = missing.map(([k, n, how]) => `<li><b>${k}</b>（${n}）<br><span>${how}</span></li>`).join('');
  return html(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>还差一步 · 免费资源雷达</title>
<style>body{margin:0;background:#f6f7f9;font:14px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#111318}.b{max-width:560px;margin:10vh auto;background:#fff;border:1px solid #e6e8ec;border-radius:8px;padding:24px 28px}h1{font-size:17px;margin:0 0 6px}p{color:#525c6b;margin:0 0 14px}li{margin-bottom:12px}li span{color:#4b5563;font-size:13px}code{background:#f1f3f6;padding:1px 5px;border-radius:4px}</style>
<div class="b"><h1>部署成功，还差一步</h1><p>在 Cloudflare 控制台打开这个 Worker，补上以下绑定后刷新本页。数据表会自动创建，管理员密码在首次打开 /admin 时设置。</p><ol>${rows}</ol><p>定时抓取：设置 → 触发事件 → 添加 Cron，填 <code>* * * * *</code>（每分钟一次，抓取时间在后台设置）。用一键部署的话已自动配置。</p></div></html>`, 503);
}

// ---------- 资源页访问密码 ----------
// 设置后：资源页、/api/items、/api/stats、/feed.xml 都需要密码。网页登录后写 30 天 Cookie；RSS 用 /feed.xml?key=密码
const SITE_COOKIE = 'frr_site';
const siteHash = (env) => memo('sitehash', 300000, () => getSitePassHash(env));
async function siteGate(req, env, url) {
  const h = await siteHash(env);
  if (!h) return { ok: true };
  const token = await sha256('cookie:' + h);
  const cookie = (req.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(SITE_COOKIE + '='));
  if (cookie && safeEqual(cookie.slice(SITE_COOKIE.length + 1), token)) return { ok: true };
  const key = url.searchParams.get('key');
  if (key && safeEqual(await sha256('frr-site:' + key), h)) return { ok: true };
  return { ok: false, token, hash: h };
}
const lockPage = () => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>免费资源雷达</title>
<style>:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#f6f7f9;color:#111318}
.b{width:min(340px,90vw);background:#fff;border:1px solid #e6e8ec;border-radius:10px;padding:26px}h1{font-size:16px;margin:0 0 4px}p{margin:0 0 16px;color:#646f80;font-size:13px}
input{width:100%;box-sizing:border-box;height:38px;border:1px solid #e6e8ec;border-radius:7px;padding:0 12px;font:inherit;background:transparent;color:inherit}button{margin-top:12px;width:100%;height:38px;border:0;border-radius:7px;background:#111318;color:#fff;font:inherit;cursor:pointer}
.e{color:#b91c1c;font-size:12px;min-height:18px;margin-top:8px}@media(prefers-color-scheme:dark){body{background:#0d0f13;color:#eef0f4}.b{background:#121419;border-color:#252932}input{border-color:#252932}button{background:#eef0f4;color:#0d0f13}}</style></head>
<body><form class="b" onsubmit="go(event)"><h1>免费资源雷达</h1><p>请输入访问密码</p><input type="password" id="p" autofocus autocomplete="current-password" placeholder="访问密码"><button>进入</button><div class="e" id="e"></div></form>
<script>async function go(e){e.preventDefault();const r=await fetch('/api/site-login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:document.getElementById('p').value})});if(r.ok)location.reload();else document.getElementById('e').textContent='密码不对';}</script></body></html>`;

export default {
  async fetch(req, env, ctx) {
    // 最外层兜底：任何异常都返回带原因的页面，而不是 Cloudflare 的 1101
    try { return await handleFetch(req, env, ctx); } catch (e) { return errorPage(e, new URL(req.url).pathname); }
  },
  async scheduled(event, env, ctx) {
    try { await handleScheduled(event, env, ctx); } catch (e) { console.error('scheduled failed', e && (e.stack || e.message || e)); }
  },
};

function errorPage(e, path) {
  const msg = String((e && (e.stack || e.message)) || e).slice(0, 1500);
  console.error('request failed', path, msg);
  if (path.startsWith('/api/')) return json({ error: msg }, 500);
  const quota = /limit|exceed|quota|too many/i.test(msg);
  return html(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>暂时打不开 · 免费资源雷达</title>
<style>body{margin:0;background:#f6f7f9;font:14px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#111318}.b{max-width:640px;margin:10vh auto;background:#fff;border:1px solid #e6e8ec;border-radius:8px;padding:24px 28px}h1{font-size:17px;margin:0 0 6px}p{color:#525c6b}pre{background:#f1f3f6;padding:10px;border-radius:6px;white-space:pre-wrap;word-break:break-all;font-size:12px}</style>
<div class="b"><h1>页面暂时打不开</h1><p>${quota ? '看起来是 Cloudflare 免费额度（D1 读写次数或请求数）今天用完了，北京时间 08:00 重置。' : '程序出错了，把下面这段发给维护者即可定位。'}</p><pre>${msg.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])}</pre><p>诊断：打开 <a href="/api/health">/api/health</a> 查看各项检查。</p></div></html>`, 500);
}

// 自检：逐项检查数据库、表结构、快照、设置，哪一项坏了一眼能看出来
async function health(env) {
  const out = {};
  const step = async (k, fn) => { const t = Date.now(); try { out[k] = { ok: true, ms: Date.now() - t, ...(await fn()) }; out[k].ms = Date.now() - t; } catch (e) { out[k] = { ok: false, error: String((e && e.message) || e).slice(0, 300) }; } };
  await step('d1', async () => ({ v: (await env.DB.prepare('SELECT 1 AS x').first())?.x }));
  await step('schema', async () => { await ensureSchema(env); return {}; });
  await step('items', async () => ({ n: (await env.DB.prepare("SELECT COUNT(*) AS n FROM items WHERE status = 'approved'").first())?.n }));
  await step('snapshot', async () => { const r = await readSnap(env, 'head'); return { ver: r?.ver || null, bytes: r?.v ? r.v.length : 0 }; });
  await step('settings', async () => { const s = await getBasicSettings(env); return { keys: Object.keys(s).length }; });
  await step('kv', async () => ({ bound: !!env.SECRETS }));
  await step('run', async () => { const r = await env.DB.prepare('SELECT id, started_at, finished_at FROM runs ORDER BY id DESC LIMIT 1').first(); return { last: r || null }; });
  return { ok: Object.values(out).every((x) => x.ok), version: '1.8.2', checks: out };
}

async function handleFetch(req, env, ctx) {
    const url = new URL(req.url);
    const missing = setupMissing(env);
    if (missing.length) return setupPage(missing, url.pathname.startsWith('/api/'));
    if (url.pathname === '/api/health') return json(await health(env));
    try {
      await ensureSchema(env);
      const ip = ipOf(req);
      if (url.pathname === '/api/site-login' && req.method === 'POST') {
        const h = await getSitePassHash(env);
        const { password } = await req.json().catch(() => ({}));
        if (!h) return json({ ok: true });
        if ((await failsOf(env, ip)) >= (Number((await basic(env)).login_max_fails) || 10)) return tooMany();
        if (!password || !safeEqual(await sha256('frr-site:' + password), h)) { await addFail(env, ip); return json({ error: '密码错误' }, 401); }
        const token = await sha256('cookie:' + h);
        return new Response('{"ok":true}', { headers: { 'content-type': 'application/json', 'set-cookie': `${SITE_COOKIE}=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax` } });
      }
      // 公开接口限频（资源页本身走缓存，主要防脚本刷接口和投票）
      if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/admin/') && url.pathname !== '/api/cron') {
        const lim = Number((await basic(env)).api_rate_per_min);
        if (!rateOk('api:' + ip, Number.isFinite(lim) ? lim : 120) || (url.pathname === '/api/vote' && !rateOk('vote:' + ip, 30))) return json({ error: '请求太频繁，稍后再试' }, 429);
      }
      if (['/', '/index.html', '/api/items', '/api/stats', '/feed.xml', '/api/data', '/api/vote'].includes(url.pathname)) {
        const g = await siteGate(req, env, url);
        if (!g.ok) return url.pathname.startsWith('/api/') || url.pathname === '/feed.xml' ? json({ error: '需要访问密码' }, 401) : html(lockPage(), 401);
      }
      if (url.pathname === '/api/vote' && req.method === 'POST') { const r = await vote(req, env); ctx.waitUntil(markDirty(env)); return r; }
      if (url.pathname === '/api/data') {
        const JS = 'application/json; charset=utf-8';
        // 没设访问密码时走边缘缓存：同一份数据 2 分钟内不再查数据库
        const edge = !(await siteHash(env)) && typeof caches !== 'undefined' && caches.default;
        if (edge) {
          const ck = new Request(url.origin + url.pathname + url.search, { method: 'GET' });
          const hit = await caches.default.match(ck).catch(() => null);
          if (hit) return hit;
          const res = await dataResp(req, url, env, JS);
          if (res.status === 200) { const c = res.clone(); const h = new Headers(c.headers); h.set('cache-control', 'public, max-age=120'); ctx.waitUntil(caches.default.put(ck, new Response(c.body, { headers: h })).catch(() => {})); }
          return res;
        }
        return dataResp(req, url, env, JS);
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        maybeVisitTick(env, ctx);
        // 省资源：页面本身是静态的，不查数据库；数据由页面加载后请求 /api/data（有边缘缓存）
        if (!(await siteHash(env))) return new Response(STATIC_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
        const d = await pageData(env, 'head');
        return sendSnap(req, d, 'text/html; charset=utf-8', PAGE_A + d.v + PAGE_B);
      }
      // 触发地址：给 cron-job.org、UptimeRobot 等外部定时服务用，或者自己访问一下手动推进
      if (url.pathname === '/api/cron') {
        const key = url.searchParams.get('key') || req.headers.get('x-cron-key') || '';
        if (!key || !safeEqual(key, await memo('cronkey', 60000, () => getCronKey(env)))) return json({ error: '触发密钥不对' }, 403);
        return json(await triggerTick(env, 'url'));
      }
      if (url.pathname === '/admin' || url.pathname === '/admin/') return html(adminHtml
        .replace('/*__CATS__*/[]', JSON.stringify(CATEGORIES.map(({ key, label, color, kw, group, info }) => ({ key, label, color, group, info: !!info, kw: kw.slice(0, 6) })))).replace('/*__GROUPS__*/[]', JSON.stringify(GROUPS))
        .replace('/*__PUSH__*/[]', JSON.stringify(PUSH_CHANNELS.map(({ id, name, key, secret, hint }) => ({ id, name, key, secret, hint }))))
        .replace('/*__BACKENDS__*/[]', JSON.stringify(BACKENDS.map(({ id, name, keyless, free, signup, note, zh }) => ({ id, name, keyless, free, signup, note, zh })))));
      if (url.pathname === '/api/items') return json(await publicItems(env, url));
      if (url.pathname === '/api/stats') {
        const st = await basic(env);
        const cutoff = Date.now() - (Number(st.max_age_days) || 180) * 86400000;
        const base = "FROM items WHERE status = 'approved' AND (published_at IS NULL OR published_at >= ?)";
        const [cats, obs, last, days] = await Promise.all([
          env.DB.prepare(`SELECT category AS k, COUNT(*) AS n ${base} GROUP BY category`).bind(cutoff).all(),
          env.DB.prepare(`SELECT obtain AS k, COUNT(*) AS n ${base} GROUP BY obtain`).bind(cutoff).all(),
          env.DB.prepare("SELECT MAX(finished_at) AS t FROM runs WHERE trigger != 'mail'").first(),
          env.DB.prepare(`SELECT day AS d, COUNT(*) AS n ${base} AND day IS NOT NULL GROUP BY day ORDER BY day DESC LIMIT 31`).bind(cutoff).all(),
        ]);
        const out = { all: 0, last_run: last?.t || null, categories: enabledCats(st).map((k) => ({ key: k, label: CAT_MAP[k].label, color: CAT_MAP[k].color })), today: dayOf(Date.now()), retention_days: Number(st.retention_days) || 15, days: (days.results || []).map((r) => ({ day: r.d, n: r.n })) };
        for (const r of cats.results || []) { out[r.k || 'other'] = r.n; out.all += r.n; }
        for (const r of obs.results || []) if (r.k) out[r.k] = r.n;
        return json(out);
      }
      if (url.pathname === '/feed.xml') {
        const st = await basic(env);
        const items = await memo('feed', Math.max(0, Number(st.public_cache_seconds) || 0) * 1000, () => publicItems(env, new URL(url.origin + '/?limit=50')));
        const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>免费资源雷达</title><link>${xmlEsc(url.origin)}</link><description>每日自动抓取并经 AI 筛选</description>${items
          .map((it) => `<item><title>${xmlEsc(it.name || it.title)}</title><link>${xmlEsc(it.url)}</link><guid isPermaLink="false">${it.id}</guid>${it.published_at ? `<pubDate>${new Date(it.published_at).toUTCString()}</pubDate>` : ''}<description>${xmlEsc([it.summary, it.signup && '注册：' + it.signup].filter(Boolean).join(' | '))}</description></item>`)
          .join('')}</channel></rss>`;
        return cached(req, body, 'application/rss+xml; charset=utf-8');
      }
      if (url.pathname.startsWith('/api/admin/')) {
        if (url.pathname === '/api/admin/status') {
          return json({ initialized: !!envToken(env) || !!(await getAdminHash(env)), env_token: !!envToken(env), storage: storageMode(env), site_locked: !!(await getSitePassHash(env)) });
        }
        if (url.pathname === '/api/admin/setup' && req.method === 'POST') {
          if (envToken(env) || (await getAdminHash(env))) return json({ error: '已经设置过管理员密码' }, 409);
          const { password } = await req.json().catch(() => ({}));
          if (!password || String(password).length < 8) return json({ error: '密码至少 8 位' }, 400);
          await setAdminHash(env, String(password));
          return json({ ok: true });
        }
        const maxFails = Number((await basic(env)).login_max_fails) || 10;
        if ((await failsOf(env, ip)) >= maxFails) return tooMany();
        if (!(await isAdmin(req, env))) { if (req.headers.get('authorization')) await addFail(env, ip); return json({ error: '未授权' }, 401); }
        if (req.method !== 'GET' && url.pathname !== '/api/admin/snap') { clearMemo(); ctx.waitUntil(markDirty(env)); } // 后台有改动：本实例缓存失效，快照稍后重新生成
        if (url.pathname === '/api/admin/password' && req.method === 'POST') {
          if (envToken(env)) return json({ error: '当前使用环境变量 ADMIN_TOKEN，请在 Cloudflare 控制台修改' }, 400);
          const { password } = await req.json().catch(() => ({}));
          if (!password || String(password).length < 8) return json({ error: '密码至少 8 位' }, 400);
          await setAdminHash(env, String(password));
          return json({ ok: true });
        }
        // 首次登录后台时自动记下站点地址，用于邮件里的“查看全部”链接
        if (url.pathname === '/api/admin/settings' && req.method === 'GET' && !/^(localhost|127\.|\[::1\])/.test(url.hostname)) {
          const cur = await getSettings(env);
          if (!cur.mail_site_url) await saveSettings(env, { mail_site_url: url.origin });
        }
        return await handleAdmin(req, env, url);
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      return errorPage(e, url.pathname);
    }
}

// 定时任务每分钟触发一次：有进行中的抓取就执行下一步；到了抓取时间就新建一次抓取
async function handleScheduled(event, env, ctx) {
    const missing = setupMissing(env);
    if (missing.length) { console.error('部署未完成，缺少绑定：' + missing.map((x) => x[0]).join(', ')); return; }
    await ensureSchema(env);
    ctx.waitUntil(autoTick(env, 'cron').catch((e) => console.error('scheduled failed', e)));
}

// 推进一次：有进行中的抓取就执行下一步；没有且到了每天的抓取时间（今天还没跑过）就新建一次
// 资源页快照：正在生成就接着生成；数据有变化时，空闲立即生成，抓取中每 10 分钟插一轮（每次只做一步）
async function snapDue(env, idle) {
  const [b, dirty, at, ver] = await Promise.all(['snap_build', 'snap_dirty', 'snap_at', 'snap_ver'].map((k) => getMeta(env, k)));
  if (b || !ver) return true;
  if (!(Number(dirty) > Number(at))) return idle && Date.now() - Number(at) > 6 * 3600000;
  return idle || Date.now() - Number(at) > 10 * 60000;
}
async function autoTick(env, trigger) {
  if (await snapDue(env, false)) {
    const sr = await snapStep(env);
    if (sr) { clearMemo(); return { idle: false, action: 'snap', message: `资源页快照 ${sr.step} / ${sr.total}`, ...sr }; }
  }
  const s = await getSettings(env);
  const steps = Math.min(50, Math.max(1, Number(s.steps_per_tick) || 1));
  const r = await tick(env, steps);
  if (!r.idle) { await markDirty(env); clearMemo(); return { ...r, action: 'step' }; }
  if (await snapDue(env, true)) {
    const sr = await snapStep(env);
    if (sr) { clearMemo(); return { idle: true, action: 'snap', message: `资源页快照 ${sr.step} / ${sr.total}`, ...sr }; }
  }
  const now = Date.now();
  // 抓取：从 run_hour 起每隔 crawl_every_hours 小时一次
  const every = Math.min(24, Math.max(1, Number(s.crawl_every_hours) || 24));
  const crawlSlot = latestSlot(now, slotHours(Number(s.run_hour) || 0, every));
  const ran = await env.DB.prepare("SELECT id FROM runs WHERE trigger IN ('cron', 'url', 'visit') AND started_at >= ? LIMIT 1").bind(crawlSlot).first();
  if (ran) {
    // 推送：到了推送时间（3 小时内）且这个时间点还没推过；正在抓取时会等抓完
    const mailSlot = latestSlot(now, parseHours(s.mail_hours));
    if (mailSlot && now - mailSlot < 3 * 3600000 && Number(await getMeta(env, 'mail_slot')) < mailSlot) {
      await setMeta(env, 'mail_slot', mailSlot);
      const h = new Date(mailSlot + 8 * 3600000).getUTCHours();
      const label = h < 11 ? '早报' : h < 17 ? '午报' : '晚报';
      const t0 = Date.now();
      let line;
      try {
        const r = await sendDigest(env, { label });
        line = r.skipped ? `– ${label}跳过：${r.skipped}` : `✓ ${label}已推送 ${r.sent} 条（${r.providers.join(' + ')}）→ ${r.to.join(', ')}${r.errors.length ? '\n✗ ' + r.errors.join('\n✗ ') : ''}`;
      } catch (e) { line = `✗ ${label}推送失败：${e.message}`; }
      // 每周精选：到了设定的星期几，随这一天的第一次推送一起发
      const bjNow = new Date(now + BJ);
      if (s.weekly_enabled === 'true' && bjNow.getUTCDay() === (Number(s.weekly_weekday) || 0) % 7 && (await getMeta(env, 'weekly_day')) !== dayOf(now)) {
        await setMeta(env, 'weekly_day', dayOf(now));
        try { const w = await sendWeekly(env); line += w.skipped ? `\n– 本周精选跳过：${w.skipped}` : `\n✓ 本周精选已推送 ${w.sent} 条（${w.providers.join(' + ')}）`; } catch (e) { line += `\n✗ 本周精选推送失败：${e.message}`; }
      }
      if (!line.includes('没有可用的推送渠道')) await env.DB.prepare("INSERT INTO runs (trigger, started_at, finished_at, stats, log) VALUES ('mail', ?, ?, '{}', ?)").bind(t0, Date.now(), line).run();
      return { idle: true, action: 'mail', message: line };
    }
    return { idle: true, action: 'wait', message: '这一轮已经抓取过了，下一轮：' + nextSlotText(now, slotHours(Number(s.run_hour) || 0, every)) };
  }
  // 只建好这一轮的步骤，第一步留到下一分钟执行（建步骤本身也要耗 CPU）
  const plan = await planRun(env, trigger);
  return { idle: false, action: 'started', run_id: plan.run_id, steps: plan.steps, message: `已开始新一轮抓取，共 ${plan.steps} 步` };
}

// ---- 时间点（北京时间） ----
const BJ = 8 * 3600000;
const parseHours = (v) => [...new Set(String(v || '').split(/[,，\s]+/).map(Number).filter((h) => Number.isInteger(h) && h >= 0 && h <= 23))].sort((a, b) => a - b);
function slotHours(start, every) { const out = []; for (let k = 0; k * every < 24; k++) out.push((start + k * every) % 24); return [...new Set(out)].sort((a, b) => a - b); }
// 最近一个已经到达的时间点（毫秒时间戳）
function latestSlot(now, hours) {
  if (!hours.length) return 0;
  const day0 = Date.parse(dayOf(now) + 'T00:00:00+08:00');
  const h = new Date(now + BJ).getUTCHours();
  const past = hours.filter((x) => x <= h);
  return past.length ? day0 + past[past.length - 1] * 3600000 : day0 - 86400000 + hours[hours.length - 1] * 3600000;
}
function nextSlotText(now, hours) { const h = new Date(now + BJ).getUTCHours(); const n = hours.find((x) => x > h); return n === undefined ? `明天 ${hours[0]}:00` : `${n}:00`; }

// 触发地址 / 访问触发：有最小间隔，间隔内直接返回，防止被频繁访问拖垮
let lastTrigger = 0;
async function triggerTick(env, trigger) {
  const s = await basic(env);
  const gap = Math.max(5, Number(s.trigger_min_seconds) || 30) * 1000;
  const now = Date.now();
  if (now - lastTrigger < gap) return { ok: true, throttled: true, retry_after: Math.ceil((gap - (now - lastTrigger)) / 1000) };
  const last = Number(await getMeta(env, 'trigger_last')) || 0;
  if (now - last < gap) { lastTrigger = last; return { ok: true, throttled: true, retry_after: Math.ceil((gap - (now - last)) / 1000) }; }
  lastTrigger = now;
  await setMeta(env, 'trigger_last', now);
  const r = await autoTick(env, trigger);
  return { ok: true, action: r.action, message: r.message, current: r.current, done: r.done, left: r.left, total: r.total, run_id: r.run_id };
}
function maybeVisitTick(env, ctx) {
  if (Date.now() - lastTrigger < 5000) return;
  ctx.waitUntil((async () => {
    const s = await basic(env);
    if (s.visit_trigger !== 'true') return;
    await triggerTick(env, 'visit');
  })().catch((e) => console.error('visit tick failed', e)));
}
