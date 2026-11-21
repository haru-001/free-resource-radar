import { ensureSchema, getSettings, saveSettings, settingsForAdmin, storageMode, getAdminHash, setAdminHash, sha256, dayOf, getSitePassHash, setSitePass } from './db.js';
import { listModels, chat } from './ai.js';
import { planRun, tick } from './crawler.js';
import { sendDigest, previewDigest } from './mailer.js';
import { BACKENDS, BACKEND_MAP, runBackend } from './search.js';
import { CATEGORIES, CAT_MAP, enabledCats } from './categories.js';
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

async function publicItems(env, url) {
  const s = await getSettings(env);
  const cutoff = Date.now() - (Number(s.max_age_days) || 180) * 86400000;
  const where = ["status = 'approved'", '(published_at IS NULL OR published_at >= ?)'];
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
  if (p === '/search-test' && m === 'POST') {
    const s = await getSettings(env);
    if (!BACKEND_MAP[body.provider]) return json({ error: '未知搜索后端' }, 400);
    const t0 = Date.now();
    const r = await runBackend({ ...s, search_max_queries: '2' }, body.provider, Number(s.max_age_days) || 180);
    return json({ ok: true, ms: Date.now() - t0, count: r.items.length, errors: r.errors, sample: r.items.slice(0, 8).map((x) => ({ title: x.title, url: x.url, date: x.published_at ? new Date(x.published_at).toISOString().slice(0, 10) : null })) });
  }
  if (p === '/mail/test' && m === 'POST') return json(await sendDigest(env, { force: true, test: true, channel: body.channel === 'telegram' ? 'telegram' : 'mail' }));
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
async function siteGate(req, env, url) {
  const h = await getSitePassHash(env);
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
    const url = new URL(req.url);
    const missing = setupMissing(env);
    if (missing.length) return setupPage(missing, url.pathname.startsWith('/api/'));
    try {
      await ensureSchema(env);
      if (url.pathname === '/api/site-login' && req.method === 'POST') {
        const h = await getSitePassHash(env);
        const { password } = await req.json().catch(() => ({}));
        if (!h) return json({ ok: true });
        if (!password || !safeEqual(await sha256('frr-site:' + password), h)) return json({ error: '密码错误' }, 401);
        const token = await sha256('cookie:' + h);
        return new Response('{"ok":true}', { headers: { 'content-type': 'application/json', 'set-cookie': `${SITE_COOKIE}=${token}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax` } });
      }
      if (['/', '/index.html', '/api/items', '/api/stats', '/feed.xml'].includes(url.pathname)) {
        const g = await siteGate(req, env, url);
        if (!g.ok) return url.pathname.startsWith('/api/') || url.pathname === '/feed.xml' ? json({ error: '需要访问密码' }, 401) : html(lockPage(), 401);
      }
      if (url.pathname === '/' || url.pathname === '/index.html') return html(publicHtml);
      if (url.pathname === '/admin' || url.pathname === '/admin/') return html(adminHtml
        .replace('/*__CATS__*/[]', JSON.stringify(CATEGORIES.map(({ key, label, color, kw }) => ({ key, label, color, kw: kw.slice(0, 6) }))))
        .replace('/*__BACKENDS__*/[]', JSON.stringify(BACKENDS.map(({ id, name, keyless, free, signup, note, zh }) => ({ id, name, keyless, free, signup, note, zh })))));
      if (url.pathname === '/api/items') return json(await publicItems(env, url));
      if (url.pathname === '/api/stats') {
        const st = await getSettings(env);
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
        const items = await publicItems(env, new URL(url.origin + '/?limit=50'));
        const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>免费资源雷达</title><link>${xmlEsc(url.origin)}</link><description>每日自动抓取并经 AI 筛选</description>${items
          .map((it) => `<item><title>${xmlEsc(it.name || it.title)}</title><link>${xmlEsc(it.url)}</link><guid isPermaLink="false">${it.id}</guid>${it.published_at ? `<pubDate>${new Date(it.published_at).toUTCString()}</pubDate>` : ''}<description>${xmlEsc([it.summary, it.signup && '注册：' + it.signup].filter(Boolean).join(' | '))}</description></item>`)
          .join('')}</channel></rss>`;
        return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
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
        if (!(await isAdmin(req, env))) return json({ error: '未授权' }, 401);
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
      return json({ error: e.message || String(e) }, 500);
    }
  },

  // 定时任务每分钟触发一次：有进行中的抓取就执行下一步；到了每天的抓取时间就新建一次抓取（最后一步自动推送）
  async scheduled(event, env, ctx) {
    const missing = setupMissing(env);
    if (missing.length) { console.error('部署未完成，缺少绑定：' + missing.map((x) => x[0]).join(', ')); return; }
    await ensureSchema(env);
    ctx.waitUntil((async () => {
      try {
        const s = await getSettings(env);
        const steps = Math.min(50, Math.max(1, Number(s.steps_per_tick) || 1));
        const r = await tick(env, steps);
        if (!r.idle) return;
        const now = Date.now();
        const hour = new Date(now + 8 * 3600000).getUTCHours();
        if (hour < (Number(s.run_hour) || 0)) return;
        const startOfDay = Date.parse(dayOf(now) + 'T00:00:00+08:00');
        const ran = await env.DB.prepare("SELECT id FROM runs WHERE trigger = 'cron' AND started_at >= ? LIMIT 1").bind(startOfDay).first();
        if (ran) return;
        await planRun(env, 'cron');
        await tick(env, steps);
      } catch (e) { console.error('scheduled failed', e); }
    })());
  },
};
