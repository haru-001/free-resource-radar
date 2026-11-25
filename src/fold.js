// 目标链接相同的条目（比如 TG 频道转发的博客文章、搜索搜到的同一页面）在展示时合并
/** 目标链接相同的条目折叠成一条，srcs 列出所有来源 [{n: 来源名, u: 链接}] */
// 统一的地址键：去掉 www / m、结尾斜杠、跟踪和邀请参数
export function targetKey(u) {
  try {
    const x = new URL(String(u || '').trim());
    for (const k of [...x.searchParams.keys()]) if (/^(utm_.*|spm|source|aff|aff_code|ref|refer|referral|invite|invite_code|inviter|via|from|share|channel|code)$/i.test(k)) x.searchParams.delete(k);
    return (x.hostname.replace(/^(www|m)\./, '').toLowerCase() + x.pathname.replace(/\/+$/, '') + x.search).slice(0, 300);
  } catch { return String(u || '').slice(0, 300); }
}
// 已存的 target 是不带协议的键，老数据可能还带着邀请参数，统一再算一遍
export const keyOf = (t) => (t ? targetKey(/^https?:\/\//i.test(t) ? t : 'https://' + t) : null);
// 一条内容有两个键：它自己的地址（ukey）和它指向的地址（target）。任何一个键撞上，就算同一条信息
export function foldItems(list) {
  const by = new Map(), out = [];
  for (const it of list) {
    let extra = [];
    try { extra = JSON.parse(it.sources || '[]'); } catch {}
    const keys = [...new Set([keyOf(it.target), it.ukey || targetKey(it.url), ...extra.map((x) => targetKey(x.u))].filter(Boolean))];
    const head = keys.map((k) => by.get(k)).find(Boolean);
    const mine = [{ n: it.source, u: it.url }, ...extra];
    if (head) { for (const x of mine) if (!head.srcs.some((y) => y.u === x.u)) head.srcs.push(x); for (const k of keys) if (!by.has(k)) by.set(k, head); continue; }
    const { target, sources, ukey, ...rest } = it;
    const o = { ...rest, srcs: mine };
    for (const k of keys) by.set(k, o);
    out.push(o);
  }
  for (const o of out) if (o.srcs.length < 2) delete o.srcs; else o.srcs = o.srcs.slice(0, 8);
  return out;
}


// ---------- 中文展示：用翻译好的标题 / 简介；仍是纯英文的条目不展示（等翻译完成） ----------
const CJK = /[\u3400-\u9fff]/;
export function zhOnly(list, s = {}) {
  const hide = s.hide_english !== 'false';
  const noEn = s.filter_english !== 'false';
  return list.filter((it) => {
    if (noEn && !CJK.test(it.title || '')) return false; // 过滤英文：原标题是纯英文的旧条目也不展示、不推送
    let x = it.extra;
    if (typeof x === 'string') { try { x = JSON.parse(x); } catch { x = null; } }
    if (x && x.zs) it.summary = x.zs;
    if (!hide) return true;
    return CJK.test((x && x.zh) || it.title || '') || CJK.test(it.summary || '');
  });
}
