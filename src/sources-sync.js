// 后台「更新源」：从内置推荐、freebie-radar 仓库和自定义地址拉取数据源，和当前列表比对，返回还没有的
// freebie-radar（ZiChuanLan/freebie-radar, MIT）的源写在 TypeScript 的 SEEDS 数组里，这里把它转成本项目的格式。
import { DEFAULT_SOURCES } from './db.js';
import { ghCommits } from './crawler.js';

export const FREEBIE_SEEDS_URL = 'https://raw.githubusercontent.com/ZiChuanLan/freebie-radar/main/src/server/collectors/index.ts';

const CJK = /[\u4e00-\u9fff]/;
// 英文站（默认过滤纯英文内容，同步过来默认不勾选）
const EN_HOSTS = ['reddit.com', 'itch.io', 'isthereanydeal.com', 'indiegamebundles.com', 'freesteamkeys.com', 'gg.deals', 'giveawayoftheday.com', 'tickcoupon.com', 'sharewareonsale.com', 'lowendtalk.com', 'lowendspirit.com', 'lowendbox.com', 'news.ycombinator.com'];
// 从 Cloudflare 机房访问会被拦（实测 403 / 验证页），同步过来默认不勾选
const BLOCKED_HOSTS = ['linux.do', 'reddit.com', 'deepflood.com', '52pojie.cn', 'hostloc.com', '423down.com'];
// 资讯类（不是白嫖资源），同步过来默认不勾选
const NEWS_HOSTS = ['chinanews.com.cn', 'wallstreetcn.com', 'qbitai.com', 'leiphone.com', 'tmtpost.com', 'ifanr.com', '36kr.com', 'huxiu.com', 'cctv.com', 'thepaper.cn', 'sspai.com', 'ithome.com', 'cnbeta.com.tw'];
// 名字是英文但内容是中文的站
const ZH_HOSTS = ['linux.do', 'nodeseek.com', 'nodeloc.com', 'deepflood.com', 'vpsgo.com', 'vpsxb.net', 'keylol.com', 'free.com.tw', 'v2ex.com', 'appinn.com', 'appinn.net', 'ghxi.com', 'yxssp.com', 'iplaysoft.com', 'vpsjxw.com', 'laozuo.org', 'veidc.com', 'vpser.net', 'banwagong.net'];
const CAT_HINT = { vps: 'hosting', hosting: 'hosting', software: 'software', pan: 'pan', game: 'game', ai: 'ai', domain: 'domain', cloud: 'cloud', dev: 'dev', edu: 'edu', course: 'course', media: 'media', design: 'design' };

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const hostIn = (h, list) => list.some((d) => h === d || h.endsWith('.' + d));
const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 一个源的唯一键：rss 按地址（去掉 www、末尾斜杠、协议），v2ex 按节点，telegram 按频道，其它按类型 + 查询词 */
export function sourceKey(x) {
  const t = x.type || 'rss';
  if (t === 'rss') {
    // 同一个 feed 按标签拆成几个源（tags / skip_tags）时各算各的
    const tg = x.tags || x.skip_tags ? '#' + [].concat(x.tags || []).join(',') + '!' + [].concat(x.skip_tags || []).join(',') : '';
    try { const u = new URL(x.url); return 'rss:' + u.hostname.replace(/^www\./, '').toLowerCase() + u.pathname.replace(/\/+$/, '') + u.search + tg; } catch { return 'rss:' + x.url + tg; }
  }
  if (t === 'v2ex') return 'v2ex:' + (x.node || 'free');
  if (t === 'repo') return 'repo:' + String(x.repo || '').toLowerCase();
  if (t === 'telegram') return 'tg:' + String(x.channel || '').toLowerCase();
  if (t === 'gamerpower') return 'gamerpower:' + (x.kind || 'game');
  return t + ':' + String(x.query || '').toLowerCase();
}

/** 把 TS 里的对象字面量数组转成 JSON 再解析（不用 eval，Workers 也不允许 eval） */
export function parseFreebieSeeds(ts) {
  const start = ts.indexOf('export const SEEDS');
  if (start < 0) throw new Error('没找到 SEEDS');
  const open = ts.indexOf('[', ts.indexOf('=', start));
  // 找到配对的 ]（跳过字符串）
  let depth = 0, end = -1, q = null;
  for (let i = open; i < ts.length; i++) {
    const ch = ts[i];
    if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
    if (ch === '/' && ts[i + 1] === '/') { const nl = ts.indexOf('\n', i); i = nl < 0 ? ts.length : nl; continue; }
    if (ch === '[' || ch === '{') depth++;
    else if ((ch === ']' || ch === '}') && --depth === 0) { end = i; break; }
  }
  if (end < 0) throw new Error('SEEDS 数组不完整');
  // 逐字符改写：去注释、单引号转双引号、给键名加引号
  const src = ts.slice(open, end + 1);
  const parts = [];
  let last = '{'; // 上一个非空白字符
  const ID0 = /[A-Za-z_$]/, IDC = /[\w$]/;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== ch) j += src[j] === '\\' ? 2 : 1;
      const body = src.slice(i + 1, j);
      parts.push(ch === '"' ? '"' + body + '"' : JSON.stringify(body.replace(/\\'/g, "'")));
      last = '"';
      i = j;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = (nl < 0 ? src.length : nl) - 1; continue; }
    if (ch === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = (e < 0 ? src.length : e + 2) - 1; continue; }
    if (ID0.test(ch)) {
      let j = i + 1;
      while (j < src.length && IDC.test(src[j])) j++;
      const word = src.slice(i, j);
      let k = j;
      while (src[k] === ' ' || src[k] === '\t') k++;
      parts.push((last === '{' || last === ',') && src[k] === ':' ? '"' + word + '"' : word);
      last = 'a';
      i = j - 1;
      continue;
    }
    parts.push(ch);
    if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t') last = ch;
  }
  let out = parts.join('');
  out = out.replace(/,(\s*[}\]])/g, '$1');
  const seeds = JSON.parse(out);
  return seeds.flatMap(seedToSources).filter(Boolean);
}

function seedToSources(seed) {
  const c = seed.config || {};
  const cat = CAT_HINT[c.fixedCategory] || CAT_HINT[c.categoryHint] || undefined;
  const info = c.kindHint === 'info' || [c.categoryHint, c.fixedCategory, ...(c.feeds || []).map((f) => f.categoryHint)].some((h) => h && !CAT_HINT[h]);
  const base = { from: 'freebie-radar', upstream_enabled: seed.enabled !== false, ...(info ? { info: true } : {}) };
  switch (seed.kind) {
    case 'rss':
      return (c.feeds || []).filter((f) => f.url).map((f, i, all) => {
        const o = { name: all.length > 1 ? `${seed.name} · ${f.id}` : seed.name, type: 'rss', url: f.url, ...base };
        if (f.titleKeywords?.length) o.include = f.titleKeywords.map(reEscape).join('|');
        if (f.only100Off) o.include = '100%';
        const hint = CAT_HINT[f.categoryHint] || cat;
        if (hint) o.hint = hint;
        return o;
      });
    case 'v2ex':
      return [{ name: seed.name, type: 'v2ex', node: c.node || 'free', ...base }];
    case 'telegram':
      return (c.channels || []).map((ch) => ({ name: `${seed.name.replace(/（.*?）/, '')} · @${ch}`, type: 'telegram', channel: ch, ...(cat ? { hint: cat } : {}), ...base }));
    case 'linuxdo':
      return c.categoryId ? [{ name: seed.name, type: 'rss', url: `https://linux.do/c/${c.rssSlug || c.categoryId}/${c.categoryId}.rss`, ...base }] : [];
    case 'epic':
      return [{ name: seed.name, type: 'epic', category: 'game', trusted: true, ...base }];
    case 'gamerpower': {
      const kind = /loot/.test(c.query || '') ? 'loot' : 'game';
      return [{ name: seed.name, type: 'gamerpower', kind, category: 'game', trusted: true, ...base }];
    }
    case 'openrouter':
      return [{ name: seed.name, type: 'openrouter_free', category: 'ai', trusted: true, ...base }];
    default:
      return [{ unsupported: true, name: seed.name, kind: seed.kind }];
  }
}

function zhOf(x) {
  const h = hostOf(x.url || '');
  if (h && hostIn(h, EN_HOSTS)) return false;
  if (h && hostIn(h, ZH_HOSTS)) return true;
  if (['v2ex', 'telegram', 'epic', 'gamerpower', 'openrouter_free'].includes(x.type)) return true;
  // 名字开头就是中文才算中文站（「FreebieShark 免费样品」这类英文站名字后面只是中文说明）
  return CJK.test(String(x.name || '').trim().split(/[\s·]/)[0]) || /\.(cn|tw|hk)$/.test(h);
}

/** 拉取所有来源并和当前列表比对 */
export async function checkSources(current, urls) {
  const have = new Set(current.map(sourceKey));
  const groups = [{ id: 'builtin', label: '内置推荐（本版本新增）', list: DEFAULT_SOURCES.map((x) => ({ ...x, from: 'builtin', upstream_enabled: x.enabled !== false })) }];
  const errors = [];
  let unsupported = 0;
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'free-resource-radar', Accept: '*/*' }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const text = await r.text();
      let list;
      if (/^\s*[[{]/.test(text)) {
        const j = JSON.parse(text);
        list = (Array.isArray(j) ? j : j.sources || []).filter((x) => x && (x.url || x.type)).map((x) => ({ ...x, from: url, upstream_enabled: x.enabled !== false }));
      } else {
        list = parseFreebieSeeds(text);
      }
      unsupported += list.filter((x) => x.unsupported).length;
      const label = url === FREEBIE_SEEDS_URL || /freebie-radar/.test(url) ? 'freebie-radar' : url.replace(/^https?:\/\//, '').slice(0, 60);
      groups.push({ id: url, label, list: list.filter((x) => !x.unsupported) });
    } catch (e) {
      errors.push(`${url}：${e.message}`);
    }
  }
  const seen = new Set(have);
  const out = [];
  let existing = 0;
  for (const g of groups) {
    const fresh = [];
    for (const x of g.list) {
      const k = sourceKey(x);
      if (x.category === 'proxy' || x.mode === 'sub' || /梯子|节点|v2ray|clash|proxy|机场/i.test(`${x.name || ''} ${x.repo || ''}`)) continue;
      if (seen.has(k)) { if (have.has(k)) existing++; continue; }
      seen.add(k);
      const zh = zhOf(x);
      const blocked = hostIn(hostOf(x.url || ''), BLOCKED_HOSTS);
      const info = x.info || hostIn(hostOf(x.url || ''), NEWS_HOSTS) && !x.include;
      const { upstream_enabled, from, info: _i, ...src } = x;
      src.enabled = true;
      const why = !zh ? '英文' : blocked ? '机房常被拦' : info ? '资讯类' : !upstream_enabled ? '上游未启用' : '';
      fresh.push({ key: k, suggest: !why, why, src });
    }
    if (fresh.length) out.push({ id: g.id, label: g.label, items: fresh });
  }
  return { groups: out, existing, unsupported, errors };
}

// ---------------- 批量添加 / 搜索发现新源 ----------------
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; free-resource-radar)', Accept: 'text/html,application/xml,application/rss+xml,*/*' };
// 搜索结果里这些大平台不是可订阅的博客/站点，跳过
const SKIP_HOSTS = ['zhihu.com', 'bilibili.com', 'weixin.qq.com', 'qq.com', 'baidu.com', 'csdn.net', 'github.com', 'gitee.com', 'douyin.com', 'weibo.com', 'xiaohongshu.com', 'toutiao.com', 'sohu.com', '163.com', 'sina.com.cn', 'youtube.com', 'google.com', 'wikipedia.org', 'jianshu.com', 'juejin.cn', 'cnblogs.com', 'smzdm.com', 'taobao.com', 'jd.com', 'apple.com', 'microsoft.com'];
const decode = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

async function getHead(url, limit = 200000) {
  const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const t = await r.text();
  return { text: t.slice(0, limit), url: r.url || url };
}
/** 看一眼订阅源：条目数、最新时间、是不是中文 */
function feedInfo(xml) {
  if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(xml.slice(0, 3000))) return null;
  const titles = [...xml.matchAll(/<(?:item|entry)[\s>][\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => decode(m[1]));
  const dates = [...xml.matchAll(/<(?:pubDate|updated|published|dc:date)>([^<]+)</gi)].map((m) => Date.parse(m[1])).filter((x) => x > 0);
  const zh = titles.length ? titles.filter((t) => CJK.test(t)).length / titles.length >= 0.5 : false;
  const name = decode((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(xml) || [])[1]).slice(0, 40);
  return { count: titles.length, latest: dates.length ? Math.max(...dates) : null, zh, name, sample: titles.slice(0, 3) };
}
const ago = (t) => { if (!t) return '无日期'; const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? '今天更新' : d + ' 天前更新'; };

/** 一个输入（网址 / t.me / @频道 / JSON）→ 一个候选源 */
async function probeOne(raw) {
  const line = raw.trim();
  if (/^\{/.test(line)) { const x = JSON.parse(line); return { src: { enabled: true, ...x }, note: 'JSON' }; }
  const tg = /^(?:https?:\/\/)?t\.me\/(?:s\/)?([A-Za-z0-9_]{4,})/.exec(line) || /^@([A-Za-z0-9_]{4,})$/.exec(line);
  if (tg) {
    const { text } = await getHead(`https://t.me/s/${tg[1]}`, 300000);
    const n = (text.match(/tgme_widget_message_text/g) || []).length;
    if (!n) throw new Error('频道没有公开消息页');
    const title = decode((/<meta property="og:title" content="([^"]+)"/.exec(text) || [])[1]) || tg[1];
    const texts = [...text.matchAll(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''));
    const dates = [...text.matchAll(/datetime="([^"]+)"/g)].map((m) => Date.parse(m[1])).filter(Boolean);
    return { src: { name: `TG · ${title}`, type: 'telegram', channel: tg[1], enabled: true }, zh: texts.filter((t) => CJK.test(t)).length >= texts.length / 2, count: n, latest: dates.length ? Math.max(...dates) : null };
  }
  // GitHub 仓库：同步它以后新增的条目（读 commits.atom，不占 API 限额）
  const gh = /^(?:https?:\/\/)?github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?(?:\/.*)?$/i.exec(line);
  if (gh && !/^(orgs|topics|search|settings|marketplace)\//.test(gh[1])) {
    const commits = await ghCommits(gh[1]);
    if (!commits.length) throw new Error('仓库没有公开提交记录');
    const subLike = commits.slice(0, 5).filter((c) => /节点|v2ray|clash|vless|trojan|机场|proxy/i.test(c.title)).length >= 3;
    if (subLike) throw new Error('这是代理节点仓库，不再收录');
    return {
      src: { name: `GitHub · ${gh[1]}`, type: 'repo', repo: gh[1], mode: 'diff', enabled: true },
      zh: commits.some((c) => CJK.test(c.title)), count: commits.length, latest: commits[0].date, sample: commits.slice(0, 3).map((c) => c.title.slice(0, 40)),
    };
  }
  if (!/^https?:\/\//.test(line)) throw new Error('不是网址、t.me 链接、GitHub 仓库或 @频道');
  const page = await getHead(line);
  let info = feedInfo(page.text), feed = page.url;
  if (!info) {
    // 网页：先找 <link rel="alternate">，找不到再试常见路径
    const alts = [...page.text.matchAll(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/gi)].map((m) => (/href=["']([^"']+)["']/.exec(m[0]) || [])[1]).filter(Boolean)
      .filter((h) => !/comments/.test(h));
    const origin = new URL(page.url).origin;
    const tries = [...alts.map((h) => new URL(h, page.url).href), `${origin}/feed`, `${origin}/rss.xml`, `${origin}/feed.xml`].filter((v, i, a) => a.indexOf(v) === i).slice(0, alts.length ? 2 : 3);
    for (const u of tries) {
      try { const f = await getHead(u); info = feedInfo(f.text); if (info) { feed = f.url; break; } } catch {}
    }
    if (!info) throw new Error('没找到 RSS/Atom 订阅地址');
  }
  const h = hostOf(feed);
  return { src: { name: info.name || h, type: 'rss', url: feed, enabled: true }, zh: info.zh, count: info.count, latest: info.latest, sample: info.sample };
}

function toCandidate(p, have) {
  const k = sourceKey(p.src);
  const h = hostOf(p.src.url || '');
  const why = have.has(k) ? '已有' : p.zh === false ? '英文' : hostIn(h, BLOCKED_HOSTS) ? '机房常被拦' : p.count === 0 ? '没有条目' : p.latest && Date.now() - p.latest > 180 * 864e5 ? '半年没更新' : '';
  const facts = [p.count != null ? p.count + ' 条' : '', p.latest !== undefined ? ago(p.latest) : ''].filter(Boolean).join(' · ');
  return { key: k, suggest: !why, why, facts, sample: (p.sample || []).join(' / ').slice(0, 120), src: p.src };
}

/** 批量添加：每行一个，最多 15 个，逐个检测 */
export async function probeInputs(current, lines) {
  const have = new Set(current.map(sourceKey));
  const items = [], errors = [];
  const list = [...new Set(lines.map((x) => x.trim()).filter(Boolean))].slice(0, 15);
  const res = await Promise.allSettled(list.map(probeOne));
  res.forEach((r, i) => (r.status === 'fulfilled' ? items.push(toCandidate(r.value, have)) : errors.push(`${list[i].slice(0, 60)}：${r.reason?.message || r.reason}`)));
  return { groups: items.length ? [{ id: 'batch', label: '批量添加', items }] : [], existing: items.filter((x) => x.why === '已有').length, errors };
}

/** 搜索发现：用搜索后端搜关键词，把结果里的站点挨个找订阅地址 */
export async function discoverSources(current, keyword, searchFn) {
  const have = new Set(current.map(sourceKey));
  const haveHosts = new Set(current.map((x) => hostOf(x.url || '')).filter(Boolean));
  const { results, errors } = await searchFn([`${keyword} RSS 订阅`, `${keyword} 博客`]);
  const hosts = [];
  for (const r of results) {
    const h = hostOf(r.url);
    if (!h || hosts.some((x) => x.h === h) || haveHosts.has(h) || hostIn(h, SKIP_HOSTS) || hostIn(h, BLOCKED_HOSTS)) continue;
    hosts.push({ h, url: new URL(r.url).origin + '/', title: r.title });
    if (hosts.length >= 8) break;
  }
  const res = await Promise.allSettled(hosts.map((x) => probeOne(x.url)));
  const items = [], miss = [];
  res.forEach((r, i) => (r.status === 'fulfilled' ? items.push(toCandidate(r.value, have)) : miss.push(hosts[i].h)));
  if (miss.length) errors.push(`这些站没找到订阅地址：${miss.join('、')}`);
  return { groups: items.length ? [{ id: 'discover', label: `搜索「${keyword}」发现`, items }] : [], existing: items.filter((x) => x.why === '已有').length, errors, searched: hosts.length };
}
