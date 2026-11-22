// 资源页快照：把资源页要用的数据提前分块算好存进 D1（snap 表），访问时直接读出来拼进页面。
// 免费版每次请求只有 10ms CPU，现算几百条数据（解析、折叠、排序、序列化）很容易超时报 1102；
// 快照由每分钟的定时任务分几步生成（每步最多 PART 条），访问只做一次读取和字符串拼接。
import { getBasicSettings, getMeta, setMeta, dayOf } from './db.js';
import { foldItems } from './fold.js';
import { GROUPS, CAT_MAP, enabledCats } from './categories.js';
import { weeklyPicks, perksOf, checkinOf } from './extras.js';

export const HEAD_N = 60; // 首屏内嵌的条数
const PART = 120;          // 之后每块的条数
const OLD_N = 200;         // 「较早发布」最多给多少条
export const ITEM_COLS = 'id, title, url, source, published_at, fetched_at, day, category, name, summary, signup, score, obtain, target, sources, extra, expires_at, up, down, dead';
const ORDER = 'ORDER BY published_at IS NULL, published_at DESC, fetched_at DESC, id';

export const shapeItems = (rows) => foldItems(rows || []).map((it) => {
  if (it.extra) { try { it.extra = JSON.parse(it.extra); } catch { delete it.extra; } } else delete it.extra;
  if (it.published_at) delete it.fetched_at;
  if (it.summary && it.summary.length > 160) it.summary = it.summary.slice(0, 160) + '…';
  delete it.target;
  for (const k of ['up', 'down', 'dead', 'expires_at', 'signup', 'score', 'obtain', 'name', 'summary', 'srcs']) if (it[k] == null || it[k] === 0) delete it[k];
  return it;
});
// 内嵌进 <script> 时 < 要转义；生成时做好，访问时不用再处理
const pack = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

function windowOf(st, now = Date.now()) {
  const cutoff = now - (Number(st.max_age_days) || 180) * 86400000;
  const fresh = now - Math.max(1, Number(st.fresh_days) || 15) * 86400000;
  const live = `status = 'approved' AND (expires_at IS NULL OR expires_at > ${now - 86400000})`;
  return { cutoff, fresh, live };
}

export async function ensureSnapTable(env) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS snap (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL)').run();
}

/** 资源页数据有变化：记一笔，定时任务会重新生成快照 */
export const markDirty = (env) => setMeta(env, 'snap_dirty', Date.now()).catch(() => {});

/** 读快照（首屏 head / 第 i 块 / old）。返回 { v, ver } 或 null */
export async function readSnap(env, part) {
  const r = await env.DB.prepare("SELECT s.v AS v, m.value AS ver FROM secrets m LEFT JOIN snap s ON s.k = m.value || ':' || ? WHERE m.key = 'meta:snap_ver'").bind(part).first().catch(() => null);
  if (!r) return null;
  // 有快照但没有这一块（比如请求了不存在的页）：返回空，不现算
  return r.v ? r : { ver: r.ver, v: part === 'head' ? null : '{"items":[]}' };
}

/** 首屏数据的公共字段 */
async function headMeta(env, st, now) {
  const { cutoff, fresh, live } = windowOf(st, now);
  const [last, oldN, total, wk] = await Promise.all([
    env.DB.prepare("SELECT MAX(finished_at) AS t FROM runs WHERE trigger != 'mail'").first(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM items WHERE ${live} AND published_at >= ? AND published_at < ?`).bind(cutoff, fresh).first(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM items WHERE ${live} AND (published_at IS NULL OR published_at >= ?)`).bind(fresh).first(),
    // 本周精选只看近 7 天、分最高的一批
    env.DB.prepare(`SELECT id, title, name, category, score, up, down, obtain, expires_at, dead, extra, published_at, fetched_at, sources FROM items WHERE ${live} AND COALESCE(published_at, fetched_at) >= ? ORDER BY score DESC LIMIT 150`).bind(now - 7 * 86400000).all(),
  ]);
  const wl = (wk.results || []).map((it) => {
    if (it.extra) { try { it.extra = JSON.parse(it.extra); } catch { it.extra = null; } }
    try { it.srcs = it.sources ? JSON.parse(it.sources) : []; } catch { it.srcs = []; }
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
    vote: true,
  };
}

/** 没有快照时（刚部署）现算一个只含首屏的数据，条数受限，CPU 可控 */
export async function liveHead(env) {
  const st = await getBasicSettings(env);
  const now = Date.now();
  const { fresh, live } = windowOf(st, now);
  const [meta, rows] = await Promise.all([
    headMeta(env, st, now),
    env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE ${live} AND (published_at IS NULL OR published_at >= ?) ${ORDER} LIMIT ${HEAD_N}`).bind(fresh).all(),
  ]);
  const items = shapeItems(rows.results);
  return pack({ ...meta, ver: 'live', parts: meta.total > HEAD_N ? -1 : 0, items });
}
/** 没有快照时按页现算（?page=i，每页 PART 条） */
export async function livePart(env, i) {
  const st = await getBasicSettings(env);
  const { fresh, live } = windowOf(st);
  const rows = await env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE ${live} AND (published_at IS NULL OR published_at >= ?) ${ORDER} LIMIT ${PART} OFFSET ?`).bind(fresh, HEAD_N + (i - 1) * PART).all();
  const items = shapeItems(rows.results);
  return pack({ items, more: items.length >= PART });
}
export async function liveOld(env) {
  const st = await getBasicSettings(env);
  const { cutoff, fresh, live } = windowOf(st);
  const rows = await env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE ${live} AND published_at >= ? AND published_at < ? ORDER BY published_at DESC LIMIT ${OLD_N}`).bind(cutoff, fresh).all();
  return pack({ items: shapeItems(rows.results) });
}

/** 生成快照的一步。返回 { building, done, step, total } 或 null（不需要生成） */
export async function snapStep(env, force = false) {
  await ensureSnapTable(env);
  let b = null;
  try { b = JSON.parse((await getMeta(env, 'snap_build')) || 'null'); } catch {}
  const now = Date.now();
  if (b && now - b.at > 30 * 60000) b = null; // 上次生成到一半就停了（太久没推进），重来
  if (!b) {
    const dirty = Number(await getMeta(env, 'snap_dirty')) || 0;
    const built = Number(await getMeta(env, 'snap_at')) || 0;
    const ver = await getMeta(env, 'snap_ver');
    // 没变化就不生成；另外每天至少重建一次（过期、换天的条目要刷新）
    if (!force && ver && dirty <= built && now - built < 6 * 3600000) return null;
    b = { ver: now.toString(36), i: 0, n: 0, at: now };
  }
  const st = await getBasicSettings(env);
  const { cutoff, fresh, live } = windowOf(st, b.at);
  const key = (p) => `${b.ver}:${p}`;
  const put = (p, v) => env.DB.prepare('INSERT INTO snap (k, v, at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, at = excluded.at').bind(key(p), v, now).run();
  if (b.i === 0) {
    // 第一步：首屏（公共字段 + 最新 HEAD_N 条）
    const [meta, rows] = await Promise.all([
      headMeta(env, st, b.at),
      env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE ${live} AND (published_at IS NULL OR published_at >= ?) ${ORDER} LIMIT ${HEAD_N}`).bind(fresh).all(),
    ]);
    b.n = Math.max(0, Math.ceil((meta.total - HEAD_N) / PART));
    b.meta = true;
    await put('head', pack({ ...meta, ver: b.ver, parts: b.n, items: shapeItems(rows.results) }));
    b.i = 1;
  } else if (b.i <= b.n) {
    const rows = await env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE ${live} AND (published_at IS NULL OR published_at >= ?) ${ORDER} LIMIT ${PART} OFFSET ?`).bind(fresh, HEAD_N + (b.i - 1) * PART).all();
    await put('part:' + b.i, pack({ items: shapeItems(rows.results) }));
    b.i++;
  } else {
    // 最后一步：较早发布的条目，然后切换到新版本、删掉旧版本
    const rows = await env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE ${live} AND published_at >= ? AND published_at < ? ORDER BY published_at DESC LIMIT ${OLD_N}`).bind(cutoff, fresh).all();
    await put('old', pack({ items: shapeItems(rows.results) }));
    await env.DB.batch([
      env.DB.prepare("INSERT INTO secrets (key, value) VALUES ('meta:snap_ver', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(b.ver),
      env.DB.prepare("INSERT INTO secrets (key, value) VALUES ('meta:snap_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(b.at)),
      env.DB.prepare("DELETE FROM secrets WHERE key = 'meta:snap_build'"),
      env.DB.prepare('DELETE FROM snap WHERE k NOT LIKE ?').bind(b.ver + ':%'),
    ]);
    return { building: false, done: true, step: b.n + 2, total: b.n + 2 };
  }
  await setMeta(env, 'snap_build', JSON.stringify({ ver: b.ver, i: b.i, n: b.n, at: b.at }));
  return { building: true, done: false, step: b.i, total: b.n + 2 };
}
