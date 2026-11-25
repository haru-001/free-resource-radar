// 每日推荐源：每天轮流拿一个已订阅分类去搜索，把找到的、还没订阅的中文 RSS 源存起来，在后台「数据源」里给你挑
import { getMeta, setMeta, dayOf } from './db.js';
import { CAT_MAP, enabledCats } from './categories.js';
import { discoverSources } from './sources-sync.js';
import { searchForDiscovery } from './search.js';

const MAX_KEEP = 30;
const readJson = async (env, k, d) => { try { return JSON.parse((await getMeta(env, k)) || '') ?? d; } catch { return d; } };

export async function readSuggest(env) {
  const box = await readJson(env, 'src_suggest', { items: [] });
  return { at: box.at || 0, last: box.last || '', items: box.items || [] };
}

/** force：后台点「立即搜一次」时不受每天一次的限制 */
export async function dailySuggest(env, s, { force = false } = {}) {
  if (!force && s.source_suggest === 'false') return null;
  const today = dayOf(Date.now());
  if (!force && (await getMeta(env, 'suggest_day')) === today) return null;
  await setMeta(env, 'suggest_day', today);
  const cats = enabledCats(s).filter((k) => CAT_MAP[k] && (CAT_MAP[k].q || []).length);
  if (!cats.length) return null;
  const round = Number(await getMeta(env, 'suggest_round')) || 0;
  await setMeta(env, 'suggest_round', String(round + 1));
  const cat = cats[round % cats.length];
  const q = CAT_MAP[cat].q;
  const kw = q[Math.floor(round / cats.length) % q.length];
  let current = [];
  try { current = JSON.parse(s.sources); } catch {}
  const r = await discoverSources(Array.isArray(current) ? current : [], kw, (qs) => searchForDiscovery(s, qs));
  const ignored = new Set(await readJson(env, 'src_ignored', []));
  const box = await readSuggest(env);
  const have = new Set(box.items.map((x) => x.key));
  const fresh = (r.groups[0]?.items || []).filter((x) => x.suggest && !ignored.has(x.key) && !have.has(x.key)).map((x) => ({ ...x, src: { ...x.src, hint: x.src.hint || cat }, kw, cat, day: today }));
  box.items = [...fresh, ...box.items].slice(0, MAX_KEEP);
  box.at = Date.now(); box.last = `${kw}：新增 ${fresh.length} 个` + (r.errors?.length ? `（${r.errors[0].slice(0, 60)}）` : '');
  await setMeta(env, 'src_suggest', JSON.stringify(box));
  return { kw, added: fresh.length, errors: r.errors || [] };
}

/** 从推荐里拿掉：added 是已加入订阅的，ignore 是不想要的（以后不再推荐） */
export async function pruneSuggest(env, { added = [], ignore = [] } = {}) {
  const drop = new Set([...added, ...ignore]);
  const box = await readSuggest(env);
  box.items = box.items.filter((x) => !drop.has(x.key));
  await setMeta(env, 'src_suggest', JSON.stringify(box));
  if (ignore.length) {
    const ig = await readJson(env, 'src_ignored', []);
    await setMeta(env, 'src_ignored', JSON.stringify([...new Set([...ignore, ...ig])].slice(0, 500)));
  }
  return box;
}
