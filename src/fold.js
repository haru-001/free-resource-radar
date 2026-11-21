// 目标链接相同的条目（比如 TG 频道转发的博客文章、搜索搜到的同一页面）在展示时合并
/** 目标链接相同的条目折叠成一条，srcs 列出所有来源 [{n: 来源名, u: 链接}] */
export function foldItems(list) {
  const by = new Map(), out = [];
  for (const it of list) {
    let extra = [];
    try { extra = JSON.parse(it.sources || '[]'); } catch {}
    const key = it.target || it.url;
    const head = by.get(key);
    const mine = [{ n: it.source, u: it.url }, ...extra];
    if (head) { for (const x of mine) if (!head.srcs.some((y) => y.u === x.u)) head.srcs.push(x); continue; }
    const { target, sources, ...rest } = it;
    const o = { ...rest, srcs: mine };
    by.set(key, o);
    out.push(o);
  }
  for (const o of out) if (o.srcs.length < 2) delete o.srcs; else o.srcs = o.srcs.slice(0, 8);
  return out;
}

