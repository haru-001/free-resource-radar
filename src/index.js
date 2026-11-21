import { ensureSchema, getSettings, saveSettings, settingsForAdmin, storageMode, getAdminHash, setAdminHash, sha256, dayOf } from './db.js';
import { listModels, chat } from './ai.js';
import { runCrawl } from './crawler.js';
import { sendDigest, previewDigest } from './mailer.js';
import { searchTavily, searchKeenable } from './search.js';
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
// 鉴权：优先用环境变量 ADMIN_TOKEN；没设置时用首次打开后台时设置的密码（哈希存 D1）
async function isAdmin(req, env) {
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!got) return false;
  if (env.ADMIN_TOKEN) return safeEqual(got, env.ADMIN_TOKEN);
  const h = await getAdminHash(env);
  return !!h && safeEqual(await sha256('frr:' + got), h);
}

// 后台请求里如果 key 是打码值或为空，则使用已保存的
function resolveAi(target, body, s) {
  const p = target === 'search' ? 'search' : 'ai';
  const key = body.api_key && !String(body.api_key).includes('****') ? body.api_key : s[`${p}_api_key`];
  return { baseUrl: body.base_url || s[`${p}_base_url`], apiKey: key, model: body.model || s[`${p}_model`], extra: p === 'search' ? body.extra_body ?? s.search_extra_body : '{}' };
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
  if (p === '/run' && m === 'POST') return json(await runCrawl(env, 'manual'));
  if (p === '/search-test' && m === 'POST') {
    const s = await getSettings(env);
    const fn = body.provider === 'keenable' ? searchKeenable : searchTavily;
    const t0 = Date.now();
    const r = await fn(s, Number(s.max_age_days) || 180);
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
<div class="b"><h1>部署成功，还差一步</h1><p>在 Cloudflare 控制台打开这个 Worker，补上以下绑定后刷新本页。数据表会自动创建，管理员密码在首次打开 /admin 时设置。</p><ol>${rows}</ol><p>定时抓取：设置 → 触发事件 → 添加 Cron，填 <code>0 1 * * *</code>（北京 09:00）。用 GitHub 部署的话已自动配置。</p></div></html>`, 503);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const missing = setupMissing(env);
    if (missing.length) return setupPage(missing, url.pathname.startsWith('/api/'));
    try {
      await ensureSchema(env);
      if (url.pathname === '/' || url.pathname === '/index.html') return html(publicHtml);
      if (url.pathname === '/admin' || url.pathname === '/admin/') return html(adminHtml);
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
        const out = { all: 0, last_run: last?.t || null, today: dayOf(Date.now()), retention_days: Number(st.retention_days) || 15, days: (days.results || []).map((r) => ({ day: r.d, n: r.n })) };
        for (const r of cats.results || []) { out[r.k || 'other'] = r.n; out.all += r.n; }
        for (const r of obs.results || []) if (r.k) out[r.k] = r.n;
        return json(out);
      }
      if (url.pathname === '/feed.xml') {
        const items = await publicItems(env, new URL(url.origin + '/?limit=50'));
        const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>免费域名 / 虚拟主机资源</title><link>${xmlEsc(url.origin)}</link><description>每日自动抓取并经 AI 筛选</description>${items
          .map((it) => `<item><title>${xmlEsc(it.name || it.title)}</title><link>${xmlEsc(it.url)}</link><guid isPermaLink="false">${it.id}</guid>${it.published_at ? `<pubDate>${new Date(it.published_at).toUTCString()}</pubDate>` : ''}<description>${xmlEsc([it.summary, it.signup && '注册：' + it.signup].filter(Boolean).join(' | '))}</description></item>`)
          .join('')}</channel></rss>`;
        return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
      }
      if (url.pathname.startsWith('/api/admin/')) {
        if (url.pathname === '/api/admin/status') {
          return json({ initialized: !!env.ADMIN_TOKEN || !!(await getAdminHash(env)), env_token: !!env.ADMIN_TOKEN, storage: storageMode(env) });
        }
        if (url.pathname === '/api/admin/setup' && req.method === 'POST') {
          if (env.ADMIN_TOKEN || (await getAdminHash(env))) return json({ error: '已经设置过管理员密码' }, 409);
          const { password } = await req.json().catch(() => ({}));
          if (!password || String(password).length < 8) return json({ error: '密码至少 8 位' }, 400);
          await setAdminHash(env, String(password));
          return json({ ok: true });
        }
        if (!(await isAdmin(req, env))) return json({ error: '未授权' }, 401);
        if (url.pathname === '/api/admin/password' && req.method === 'POST') {
          if (env.ADMIN_TOKEN) return json({ error: '当前使用环境变量 ADMIN_TOKEN，请在 Cloudflare 控制台修改' }, 400);
          const { password } = await req.json().catch(() => ({}));
          if (!password || String(password).length < 8) return json({ error: '密码至少 8 位' }, 400);
          await setAdminHash(env, String(password));
          return json({ ok: true });
        }
        return await handleAdmin(req, env, url);
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      return json({ error: e.message || String(e) }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    const missing = setupMissing(env);
    if (missing.length) { console.error('部署未完成，缺少绑定：' + missing.map((x) => x[0]).join(', ')); return; }
    await ensureSchema(env);
    // 先抓取，再发日报（抓取失败也照样尝试发送已有内容）
    ctx.waitUntil((async () => {
      try { await runCrawl(env, 'cron'); } catch (e) { console.error('crawl failed', e); }
      try {
        const r = await sendDigest(env);
        await env.DB.prepare('INSERT INTO runs (trigger, started_at, finished_at, stats, log) VALUES (?, ?, ?, ?, ?)')
          .bind('mail', Date.now(), Date.now(), JSON.stringify(r), r.skipped ? `推送跳过：${r.skipped}` : `✓ 已推送 ${r.sent} 条（${r.providers.join(' + ')}）→ ${r.to.join(', ')}${r.errors.length ? '\n✗ ' + r.errors.join('\n✗ ') : ''}`).run();
      } catch (e) {
        console.error('digest failed', e);
        await env.DB.prepare('INSERT INTO runs (trigger, started_at, finished_at, stats, log) VALUES (?, ?, ?, ?, ?)')
          .bind('mail', Date.now(), Date.now(), '{}', `✗ 推送失败：${e.message}`).run();
      }
    })());
  },
};
