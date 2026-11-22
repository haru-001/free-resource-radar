// Vercel 入口：所有路径都经 vercel.json 重写到这个函数
// 数据库用 Turso（环境变量 TURSO_DATABASE_URL + TURSO_AUTH_TOKEN），对外接口和 D1 一样，业务代码不用改
import { tursoD1 } from './turso.js';

const VERSION = '2.0.0';
let app = null, loadErr = null, envCache = null;

function makeEnv() {
  if (envCache) return envCache;
  const e = process.env;
  const url = e.TURSO_DATABASE_URL || e.LIBSQL_URL || e.DATABASE_URL_TURSO || '';
  const token = e.TURSO_AUTH_TOKEN || e.LIBSQL_AUTH_TOKEN || '';
  envCache = {
    DB: /^(libsql|turso|https?|wss?):\/\//.test(url) ? tursoD1(url, token) : undefined,
    ADMIN_TOKEN: e.ADMIN_TOKEN || '',
    TICK_BUDGET_MS: e.TICK_BUDGET_MS || '',
    PLATFORM: 'vercel',
  };
  return envCache;
}

// Vercel 的 waitUntil：响应发出后继续跑后台任务（拿不到时就直接等它跑完）
function makeCtx() {
  const pending = [];
  const rc = globalThis[Symbol.for('@vercel/request-context')]?.get?.();
  return {
    waitUntil(p) { const q = Promise.resolve(p).catch((e) => console.error('background task failed', e)); if (rc?.waitUntil) rc.waitUntil(q); else pending.push(q); },
    passThroughOnException() {},
    flush: () => Promise.all(pending),
  };
}

async function load() {
  if (app || loadErr) return;
  try { app = await import('./index.js'); } catch (e) { loadErr = e; console.error('启动失败', e && (e.stack || e)); }
}
const text = (t, status = 200) => new Response(t, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

async function handle(request) {
  // vercel.json 把原路径放在 __path 参数里，这里还原成原来的请求地址
  let req = request;
  const u = new URL(request.url);
  const p = u.searchParams.get('__path');
  if (p !== null) {
    u.searchParams.delete('__path');
    u.pathname = '/' + p.replace(/^\/+/, '');
    const m = request.method;
    req = new Request(u.toString(), { method: m, headers: request.headers, body: m === 'GET' || m === 'HEAD' ? undefined : await request.arrayBuffer() });
  }
  if (u.pathname === '/ping' || u.pathname === '/__ping') return text('pong v' + VERSION + ' (vercel)');
  await load();
  if (loadErr) return text('程序加载失败（把这段发给维护者）：\n\n' + String(loadErr.stack || loadErr), 500);
  const env = makeEnv();
  // Vercel 自带的定时任务（一天一次，作为兜底；主力是 cron-job.org 访问 /api/cron）
  if (u.pathname === '/api/vercel-cron') {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.get('authorization') !== 'Bearer ' + secret) return text('unauthorized', 401);
    try { return Response.json(await app.cronTick(env)); } catch (e) { return Response.json({ ok: false, error: String(e.message || e) }, { status: 500 }); }
  }
  const ctx = makeCtx();
  const res = await app.default.fetch(req, env, ctx);
  await ctx.flush();
  return res;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
