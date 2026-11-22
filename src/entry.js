// 入口：程序在第一次请求时才加载。万一加载出错，页面直接显示原因，而不是 Cloudflare 的 1101
let app = null, err = null;
async function boot() {
  if (app || err) return;
  try { app = (await import('./index.js')).default; } catch (e) { err = e; console.error('启动失败', e && (e.stack || e)); }
}
const txt = (t, e) => new Response(t + '\n\n' + String((e && (e.stack || e.message)) || e), { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
export default {
  async fetch(req, env, ctx) {
    if (['/ping', '/__ping'].includes(new URL(req.url).pathname)) return new Response('pong v1.8.4', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    await boot();
    if (err) return txt('程序加载失败（把这段发给维护者）：', err);
    try { return await app.fetch(req, env, ctx); } catch (e) { return txt('请求处理失败：', e); }
  },
  async scheduled(event, env, ctx) {
    await boot();
    if (err) return;
    try { await app.scheduled(event, env, ctx); } catch (e) { console.error('scheduled failed', e && (e.stack || e)); }
  },
};
