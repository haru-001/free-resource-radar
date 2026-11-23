// 免费资源雷达 PWA：首页和数据先走网络，断网时用上次的缓存；后台和管理接口不缓存
const CACHE = 'frr-v1';
const CACHEABLE = (u) => u.origin === location.origin && (u.pathname === '/' || u.pathname === '/api/data' || /\.(svg|png|webmanifest)$/.test(u.pathname));
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/icon.svg']).catch(() => {}))); });
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || !CACHEABLE(u)) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('/'))));
});
