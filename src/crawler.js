// 抓取、过滤、AI 判定的主流程
import { getSettings, lines, getMeta, setMeta } from './db.js';
import { judgeBatch } from './ai.js';
import { sendDigest } from './mailer.js';
import { dayOf } from './db.js';
import { CAT_MAP, enabledCats, guessCategory, topicWordsFor, kwHit, compileWords, isInfoCat } from './categories.js';
import { BACKENDS, BACKEND_MAP, backendReady, runBackend, backendCats } from './search.js';
import { isNoiseTitle, guessObtain, compileBlockRules, matchBlock, titleFingerprint, cleanTitle, extractDeadline, extractCodes, firstSentence, stripNegated } from './rules.js';
import { guessVendor, guessPerk, radarQueries } from './extras.js';
import { deliver } from './mailer.js';

const UA = 'Mozilla/5.0 (compatible; FreeResourceRadar/1.0; +https://workers.cloudflare.com)';
const DAY = 86400000;

// maxBytes：只读前 N 字节就断开（RSS 最新的条目在最前面），大 feed 不必整份下载解码，省 CPU
async function getText(url, headers = {}, maxBytes = 0) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: '*/*', ...headers },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (!maxBytes || !r.body) return r.text();
  const reader = r.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  reader.cancel().catch(() => {});
  const buf = new Uint8Array(Math.min(size, maxBytes));
  let off = 0;
  for (const c of chunks) { const part = c.subarray(0, buf.length - off); buf.set(part, off); off += part.length; if (off >= buf.length) break; }
  return new TextDecoder().decode(buf);
}
const getJson = async (url, headers) => JSON.parse(await getText(url, { Accept: 'application/json', ...headers }));

// ---------- 文本工具 ----------
const ENT = { nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' };
export function decodeEntities(s) {
  s = String(s || '');
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|nbsp|quot|apos|lt|gt|amp);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch { return m; } }
    return ENT[e.toLowerCase()] ?? m;
  });
}
export function cleanText(s) {
  let t = String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  t = decodeEntities(t); // 有些源把 HTML 转义后放进 description
  t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
  return decodeEntities(t).replace(/\s+/g, ' ').trim();
}
// 用 indexOf 取标签内容，避免大 feed（如 LowEndTalk 600KB+）上跑回溯正则，省 CPU（免费版每次只有 10ms）
function tag(block, name) {
  const lower = block; // feed 标签名一般是小写
  let i = 0;
  for (;;) {
    i = lower.indexOf('<' + name, i);
    if (i < 0) return '';
    const ch = lower[i + name.length + 1];
    if (ch === '>' || ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r' || ch === '/') break;
    i += name.length + 1;
  }
  const gt = block.indexOf('>', i);
  if (gt < 0 || block[gt - 1] === '/') return '';
  const end = block.indexOf('</' + name + '>', gt);
  return end < 0 ? '' : block.slice(gt + 1, end);
}
/** 目标链接的比较键：去掉协议、www / m.、末尾斜杠和跟踪参数 */
export function targetKey(u) {
  try {
    const x = new URL(normalizeUrl(u));
    // 邀请 / 推广参数不同也算同一个地址
    for (const k of [...x.searchParams.keys()]) if (/^(aff|aff_code|ref|refer|referral|invite|invite_code|inviter|via|from|share|channel|code)$/i.test(k)) x.searchParams.delete(k);
    return (x.hostname.replace(/^(www|m)\./, '').toLowerCase() + x.pathname.replace(/\/+$/, '') + x.search).slice(0, 300);
  } catch { return String(u || '').slice(0, 300); }
}
const mergeSources = (a, b) => { const out = [...a]; for (const x of b) if (!out.some((y) => y.u === x.u)) out.push(x); return out.slice(0, 12); };
export function parseTelegram(html, ch) {
  const out = [];
  const parts = html.split('class="tgme_widget_message_wrap');
  for (let i = parts.length - 1; i >= 1 && out.length < 30; i--) {
    const b = parts[i];
    const post = /data-post="([^"]+)"/.exec(b);
    const tm = b.indexOf('tgme_widget_message_text');
    if (!post || tm < 0) continue;
    const st = b.indexOf('>', tm) + 1;
    const end = b.indexOf('</div>', st);
    const textHtml = b.slice(st, end < 0 ? st + 4000 : end).replace(/<br\s*\/?>/gi, '\n');
    const text = decodeEntities(textHtml.replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').trim();
    if (!text) continue;
    const first = text.split('\n').map((x) => x.trim()).find((x) => x.length > 1) || text;
    const dt = /datetime="([^"]+)"/.exec(b);
    const link = /<a[^>]+href="(https?:\/\/(?!t\.me)[^"]+)"/.exec(b.slice(st, end));
    out.push({
      title: first.replace(/^[^\p{L}\p{N}【\[（(]+/u, '').slice(0, 120),
      url: `https://t.me/${post[1]}`,
      published_at: dt ? parseDate(dt[1]) : null,
      raw_text: (text.slice(0, 1200) + (link ? `\n链接：${decodeEntities(link[1])}` : '')).slice(0, 1500),
      target: link ? decodeEntities(link[1]) : null, // 频道消息指向的原文，用来和其它来源合并
    });
  }
  return out;
}
export function parseDate(s) {
  if (!s) return null;
  const t = Date.parse(String(s).replace(/<!\[CDATA\[|\]\]>/g, '').trim());
  return Number.isFinite(t) ? t : null;
}
export function parseFeed(xml) {
  const open = xml.includes('<item') ? 'item' : 'entry';
  const out = [];
  let i = 0;
  while (out.length < 200) {
    i = xml.indexOf('<' + open, i);
    if (i < 0) break;
    const c = xml[i + open.length + 1];
    if (c !== '>' && c !== ' ' && c !== '\n' && c !== '\r' && c !== '\t') { i += 2; continue; }
    const end = xml.indexOf('</' + open + '>', i);
    if (end < 0) break;
    const b = xml.slice(i, end);
    i = end + open.length + 3;
    let link = cleanText(tag(b, 'link'));
    if (!link) {
      const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || b.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = alt ? decodeEntities(alt[1]) : cleanText(tag(b, 'guid'));
    }
    // 正文只取前 3000 字符再清洗，长帖不必全部处理
    const body = tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded') || tag(b, 'content');
    const plain = cleanText(body.slice(0, 2000));
    // <category> 标签（有些源按轨道 / 栏目打标签，数据源可以用 tags / skip_tags 只收某几类）
    const tags = [];
    for (let k = b.indexOf('<category'); k >= 0 && tags.length < 8; k = b.indexOf('<category', k + 9)) {
      const gt = b.indexOf('>', k), e = b.indexOf('</category>', gt);
      if (gt < 0 || e < 0 || b[gt - 1] === '/') { const m = /term=["']([^"']+)/.exec(b.slice(k, gt + 1)); if (m) tags.push(decodeEntities(m[1])); continue; }
      tags.push(cleanText(b.slice(gt + 1, e)));
    }
    out.push({
      tags,
      title: cleanText(tag(b, 'title')),
      url: link,
      published_at: parseDate(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'dc:date') || tag(b, 'updated')),
      raw_text: plain.slice(0, 1200),
      target: contentTarget(body.slice(0, 4000), link),
    });
  }
  // 同一个 feed 里多篇都带的链接是页脚 / 赞助位，不算“指向的地址”
  const n = {};
  for (const x of out) if (x.target) n[x.target] = (n[x.target] || 0) + 1;
  for (const x of out) if (x.target && n[x.target] > 1) x.target = null;
  return out;
}
const SKIP_TARGET = /(^|\.)(twitter\.com|x\.com|facebook\.com|weibo\.com|t\.me|telegram\.me|gravatar\.com|creativecommons\.org|feedburner\.com|wordpress\.org|wp\.com|qr\.|github\.com$)/i;
/** 正文里指向的外部地址（第一个不是本站、不是图片和分享按钮的链接） */
export function contentTarget(html, self) {
  if (!html) return null;
  let own = '';
  try { own = new URL(self).hostname.replace(/^www\./, ''); } catch {}
  const re = /href=(?:"|'|&quot;|&#34;|&#x22;)(https?:\/\/[^"'<>\s]+?)(?:"|'|&quot;|&#34;|&#x22;)/gi;
  let m, k = 0;
  while ((m = re.exec(html)) && k++ < 12) {
    const u = decodeEntities(m[1]);
    let h;
    try { const x = new URL(u); h = x.hostname.replace(/^www\./, ''); if (x.pathname.length < 2 && !x.search) continue; } catch { continue; }
    if (!h || h === own || h.endsWith('.' + own) || own.endsWith('.' + h)) continue;
    if (SKIP_TARGET.test(h) || /\.(png|jpe?g|gif|webp|svg|mp4|mp3)(\?|$)/i.test(u) || /\/(share|sharer|intent|tag|category|author)\b/i.test(u)) continue;
    return u;
  }
  return null;
}
export function normalizeUrl(u) {
  try {
    const url = new URL(String(u).trim());
    url.hash = '';
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|ref$|source$|spm$)/i.test(k)) url.searchParams.delete(k);
    return url.toString();
  } catch {
    return String(u || '').trim();
  }
}
async function hashId(s) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- GitHub 仓库：commits.atom + 提交的 .patch（github.com 页面，不占 API 限额） ----------
const GH = { 'User-Agent': 'Mozilla/5.0 (compatible; FreeResourceRadar/1.0)' };
export async function ghCommits(repo) {
  const xml = await getText(`https://github.com/${repo}/commits.atom`, { ...GH, Accept: 'application/atom+xml' }, 80000);
  const out = [];
  for (const b of xml.split('<entry>').slice(1)) {
    const sha = (/Commit\/([0-9a-f]{40})/.exec(b) || [])[1];
    if (sha) out.push({ sha, title: cleanText(tag(b, 'title')), date: parseDate(tag(b, 'updated')), link: `https://github.com/${repo}/commit/${sha}` });
  }
  return out;
}
async function ghPatch(repo, sha) {
  // github.com 偶尔回 503，重试一次
  try { return await getText(`https://github.com/${repo}/commit/${sha}.patch`, { ...GH, Accept: 'text/plain' }, 160000); }
  catch { return getText(`https://github.com/${repo}/commit/${sha}.patch`, { ...GH, Accept: 'text/plain' }, 160000); }
}
/** 从 patch 里取新增的行（只看匹配 path 的文件，默认 .md） */
export function addedLines(patch, pathRe) {
  const out = [];
  let file = '', ok = false;
  for (const l of patch.split('\n')) {
    if (l.startsWith('diff --git ')) { file = l.split(' b/').pop() || ''; ok = pathRe.test(file); continue; }
    if (ok && l.startsWith('+') && !l.startsWith('+++')) out.push(l.slice(1));
  }
  return out;
}
const MD_LINK = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
const GENERIC_LINK = /^(注册链接|注册|链接|官网|官网链接|地址|入口|官方入口|官方来源|官方链接|官方页|官方页面|官方文档|文档|公告|活动公告|活动页|专属链接|点击|访问|前往|link|website|docs|官方|source|源码|github|详情|官方免费层|免费层|试用|限时|限时免费|永久免费|试用 \/ 限时权益|有效|待核实|已失效)$/i;
const mdPlain = (x) => decodeEntities(x.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(MD_LINK, '$1').replace(/<[^>]+>/g, ' ').replace(/[*_`>#]|:[a-z0-9_+-]+:/g, '').replace(/\s+/g, ' ')).trim();
/** 清单里新增的一行（表格行或列表项）→ 一条资源 */
export function lineToItem(line) {
  const l = line.trim();
  if (l.length < 6 || /^#|^\|?\s*:?-{3}|^<!--|^>|^(POST|GET|curl)\s/i.test(l)) return null;
  const links = [...l.matchAll(MD_LINK)].filter((m) => !/^!/.test(l.slice(Math.max(0, m.index - 1), m.index))).map((m) => ({ t: mdPlain(m[1]), u: m[2] }));
  if (!links.length) { const m = /https?:\/\/[^\s|)<>"'`，。；]+/.exec(l); if (m) links.push({ t: '', u: m[0].replace(/[.,;:!?]+$/, '') }); }
  const pick = links.find((x) => !/\.(png|jpe?g|gif|svg|webp)(\?|$)/i.test(x.u) && !/shields\.io|badge|camo\.|\/\/github\.com\/[^/]+\/?$|\/\/github\.com\/[^/]+\/[^/]+\/(issues|pulls|blob|tree)/i.test(x.u));
  if (!pick) return null;
  let name, summary;
  if (l.startsWith('|')) {
    const cells = l.split('|').slice(1, -1).map(mdPlain).filter(Boolean);
    const useful = cells.filter((x) => !/^[\d.\s]+$/.test(x) && !/^\d{4}[-/.]\d{1,2}([-/.]\d{1,2})?$/.test(x) && !GENERIC_LINK.test(x) && !/^https?:/i.test(x) && !/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(x) && !/^[✅❌⚠️✔️✖️🟢🔴🟡\s]+$/u.test(x));
    if (!useful.length) return null;
    name = useful[0];
    summary = useful.slice(1).sort((a, b) => b.length - a.length)[0] || '';
  } else {
    const p = mdPlain(l.replace(/^[-*+]\s+|^\d+\.\s+/, ''));
    name = pick.t && !GENERIC_LINK.test(pick.t) ? pick.t : p.split(/[：:，,。\-–—|]/)[0].trim();
    summary = p.replace(name, '').replace(/^[\s:：\-–—|,，]+/, '').trim();
  }
  name = String(name || '').trim();
  if (name.length > 30) { const cut = name.search(/[：:，,。；;（(]/); name = (cut >= 4 && cut <= 30 ? name.slice(0, cut) : name.slice(0, 30) + '…'); }
  if (name.length < 2) return null;
  return { title: (summary ? `${name}：${summary}` : name).slice(0, 160), name, url: pick.u, summary: summary.slice(0, 200), raw_text: mdPlain(l).slice(0, 600) };
}

/** 订阅里大概有多少个节点（只读前 150KB）：Clash 数 "- name:"，V2Ray 订阅先 base64 解码再数 xxx:// 行 */
export async function countNodes(url) {
  const t = await getText(url, { Accept: 'text/plain, */*' }, 150000);
  const more = t.length >= 149000;
  if (/^\s*(proxies:|port:|mixed-port:|allow-lan:|mode:|#)/m.test(t.slice(0, 3000))) return { n: (t.match(/^\s*-\s*(\{\s*)?name:/gm) || []).length, more };
  let body = t;
  if (!/:\/\//.test(t.slice(0, 500))) { try { body = atob(t.replace(/\s+/g, '').slice(0, more ? Math.floor(t.replace(/\s+/g, '').length / 4) * 4 : undefined)); } catch { body = t; } }
  return { n: (body.match(/^(vmess|vless|trojan|ss|ssr|hysteria2?|hy2|tuic|wireguard|socks5?|http|https|anytls):\/\//gim) || []).length, more };
}

async function fetchRepo(src, env) {
  const repo = String(src.repo || '').replace(/^https?:\/\/github\.com\//, '').replace(/\.git$|\/+$/g, '');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('repo 应写成 owner/name');
  const commits = await ghCommits(repo);
  if (!commits.length) return [];
  if (src.mode === 'sub') {
    // 节点订阅仓库：一个仓库只占一条，每次有新提交就刷新这条的时间和说明
    const c0 = commits[0];
    const subs = (src.subs || []).slice(0, 6);
    let nodes = null, more = false;
    if (subs[0]) { try { const r = await countNodes(subs[0][1]); nodes = r.n; more = r.more; } catch {} }
    return [{
      title: `${src.name || repo} · 免费节点订阅`, name: src.name || repo, url: `https://github.com/${repo}`, published_at: c0.date, upsert: true,
      summary: `最近更新：${c0.title}`.slice(0, 200), raw_text: `${c0.title} 免费节点订阅`,
      extra: { subs, commit: c0.link, nodes, nodes_more: more || undefined },
    }];
  }
  const key = 'gh:' + repo;
  const last = await getMeta(env, key);
  const at = last ? commits.findIndex((c) => c.sha === last) : -1;
  // 第一次只看最近 2 次提交；之后看上次同步以来的新提交（最多 max_commits 个）
  let fresh = !last ? commits.slice(0, 2) : at < 0 ? commits.slice(0, 3) : commits.slice(0, at);
  fresh = fresh.slice(0, Math.min(5, Number(src.max_commits) || 3));
  let pathRe = /\.(md|markdown)$/i;
  if (src.path) { try { pathRe = new RegExp(src.path, 'i'); } catch {} }
  const out = [];
  for (const c of fresh) {
    const added = addedLines(await ghPatch(repo, c.sha), pathRe);
    if (added.length > 400) continue; // 整份重新生成的大提交，不是新增条目
    for (const l of added) {
      const it = lineToItem(l);
      if (it) out.push({ ...it, published_at: c.date, raw_text: `${it.raw_text}（来自 ${repo} 的提交：${c.title}）`.slice(0, 900) });
      if (out.length >= 40) break;
    }
  }
  await setMeta(env, key, commits[0].sha);
  return out;
}

// ---------- 各类数据源 ----------
async function fetchSource(src, cutoff, env) {
  const q = encodeURIComponent(src.query || '');
  switch (src.type) {
    case 'hn': {
      const j = await getJson(`https://hn.algolia.com/api/v1/search_by_date?query=${q}&advancedSyntax=true&tags=story&hitsPerPage=50&numericFilters=created_at_i>${Math.floor(cutoff / 1000)}`);
      return (j.hits || []).map((h) => ({
        title: h.title || '',
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        published_at: (h.created_at_i || 0) * 1000 || parseDate(h.created_at),
        raw_text: cleanText(h.story_text || '').slice(0, 1500) + ` (HN: https://news.ycombinator.com/item?id=${h.objectID})`,
      }));
    }
    case 'v2ex': {
      const j = await getJson(`https://www.v2ex.com/api/topics/show.json?node_name=${encodeURIComponent(src.node || 'free')}`);
      if (!Array.isArray(j)) throw new Error('V2EX 返回异常');
      return j.map((t) => ({
        title: t.title || '',
        url: t.url || `https://www.v2ex.com/t/${t.id}`,
        published_at: (t.created || 0) * 1000 || null,
        raw_text: cleanText(t.content || '').slice(0, 1500),
      }));
    }
    case 'reddit': {
      const base = src.subreddit ? `https://www.reddit.com/r/${src.subreddit}/search.json?restrict_sr=1&` : 'https://www.reddit.com/search.json?';
      const j = await getJson(`${base}q=${q}&sort=new&t=year&limit=50`);
      return (j.data?.children || []).map(({ data: d }) => ({
        title: d.title || '',
        url: `https://www.reddit.com${d.permalink}`,
        published_at: (d.created_utc || 0) * 1000 || null,
        raw_text: [d.selftext, d.url && !d.is_self ? `链接：${d.url}` : ''].filter(Boolean).join(' ').slice(0, 1500),
      }));
    }
    case 'github': {
      const since = new Date(cutoff).toISOString().slice(0, 10);
      const headers = { Accept: 'application/vnd.github+json' };
      if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
      const j = await getJson(`https://api.github.com/search/repositories?q=${encodeURIComponent(`${src.query} pushed:>${since}`)}&sort=updated&order=desc&per_page=30`, headers);
      return (j.items || []).map((r) => ({
        title: `${r.full_name}${r.description ? ' - ' + r.description : ''}`,
        url: r.html_url,
        published_at: parseDate(r.pushed_at),
        raw_text: `${r.description || ''} ★${r.stargazers_count}${r.homepage ? ' 主页：' + r.homepage : ''}`,
      }));
    }
    case 'gamerpower': {
      const j = await getJson(`https://www.gamerpower.com/api/giveaways?type=${encodeURIComponent(src.kind || 'game')}`);
      if (!Array.isArray(j)) return [];
      return j.filter((g) => g.status !== 'Expired').map((g) => ({
        title: `${g.title}（${g.platforms || ''}）`,
        url: g.open_giveaway_url || g.gamerpower_url,
        published_at: parseDate(String(g.published_date || '').replace(' ', 'T') + 'Z'),
        raw_text: `${cleanText(g.description).slice(0, 400)} 原价 ${g.worth || 'N/A'}${g.end_date && g.end_date !== 'N/A' ? '，截止 ' + g.end_date : ''}`,
        name: g.title,
        summary: `${g.platforms || ''} 免费领取${g.worth && g.worth !== 'N/A' ? '，原价 ' + g.worth : ''}${g.end_date && g.end_date !== 'N/A' ? '，截止 ' + g.end_date.slice(0, 10) : ''}`,
        signup: (g.platforms || '').split(',')[0].trim() + ' 账号',
      }));
    }
    case 'epic': {
      const j = await getJson('https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=zh-CN&country=CN&allowCountries=CN');
      const out = [];
      for (const e of j?.data?.Catalog?.searchStore?.elements || []) {
        const offers = (e.promotions?.promotionalOffers || []).flatMap((g) => g.promotionalOffers || []);
        const free = offers.find((o) => o.discountSetting?.discountPercentage === 0);
        if (!free) continue;
        const slug = e.catalogNs?.mappings?.[0]?.pageSlug || e.productSlug || e.urlSlug;
        const end = parseDate(free.endDate);
        out.push({
          title: `Epic 免费领取：${e.title}`,
          url: slug ? `https://store.epicgames.com/p/${slug}` : 'https://store.epicgames.com/free-games',
          published_at: parseDate(free.startDate) || Date.now(),
          raw_text: cleanText(e.description || '').slice(0, 400),
          name: e.title,
          summary: `Epic 限时免费，领取后永久入库${end ? '，截止 ' + dayOf(end) : ''}`,
          signup: 'Epic 账号',
        });
      }
      return out;
    }
    case 'openrouter_free': {
      // max_price=0 只返回免费模型（约 20KB，比完整列表小得多）
      const j = await getJson('https://openrouter.ai/api/v1/models?max_price=0');
      return (j.data || []).filter((m) => String(m.id).endsWith(':free')).map((m) => ({
        title: `OpenRouter 免费模型：${m.name}`,
        url: `https://openrouter.ai/${String(m.id)}`,
        published_at: (m.created || 0) * 1000 || null,
        raw_text: cleanText(String(m.description || '').slice(0, 600)).slice(0, 400),
        name: m.name,
        summary: `OpenRouter 上的免费模型，API 调用不计费（有频率限制）${m.context_length ? '，上下文 ' + Math.round(m.context_length / 1000) + 'K' : ''}`,
        signup: '邮箱 / GitHub / Google',
      }));
    }
    case 'repo':
      return fetchRepo(src, env);
    case 'telegram': {
      // Telegram 公开频道网页版 t.me/s/<频道>，最新消息在页面末尾
      const ch = String(src.channel || '').replace(/^@/, '').trim();
      if (!/^\w{4,}$/.test(ch)) throw new Error('缺少 channel');
      return parseTelegram(await getText(`https://t.me/s/${ch}`, { Accept: 'text/html' }, 300000), ch);
    }
    case 'rss':
    default:
      if (!src.url) throw new Error('缺少 url');
      return parseFeed(await getText(src.url, { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' }, 120000));
  }
}

// ---------- 过滤 ----------
const CJK = /[\u4e00-\u9fff]/;
function isBlocked(u, domains) {
  if (!domains.length) return false;
  let host = '';
  try { host = new URL(u).hostname.toLowerCase(); } catch { return false; }
  return domains.some((d) => host === d || host.endsWith('.' + d));
}
const containsAny = (text, words) => words.some((w) => text.includes(w));

const csv = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => String(x).trim()).filter(Boolean);
/** 条目允许的分类：来源限定的分类 ∩ 已勾选分类 */
function allowedOf(item, cats) { const own = csv(item.cats); return own.length ? cats.filter((k) => own.includes(k)) : cats; }

function heuristicJudge(item, s) {
  const text = stripNegated(`${item.title} ${item.raw_text || ''}`).toLowerCase();
  const hard = s.simple_signup_only !== 'false' && lines(s.hard_signup_keywords).find((w) => text.includes(w));
  const obtain = guessObtain(item.title, item.raw_text || '');
  const allowed = lines(s.allowed_obtain);
  const allow = allowedOf(item, enabledCats(s));
  const category = guessCategory(text, allow) || (item.hint && allow.includes(item.hint) ? item.hint : null) || 'other';
  // 资讯 / 梯子类不是“白嫖资源”：来源本身就是资讯源（默认分类就是它）才免免费词直接收；论坛帖子归到这几类照常按免费词判
  if (isInfoCat(category) && item.hint === category) return { status: 'approved', obtain: null, category, name: null, summary: firstSentence(item.raw_text, 90), signup: null, score: null, judged_by: 'keywords' };
  const asking = /^(求|请问|问下|问一下|有没有|求助|求推荐)|[？?]\s*$/.test(String(item.title || '').trim());
  return {
    // 没有 AI 时更保守：标题里要有“免费 / 白嫖 / free”之类的字样；提问帖不收
    status: asking || hard || !(allowed.includes(obtain) || (category === 'aideal' && obtain === 'trial')) || category === 'other' || !lines(s.free_keywords).some((w) => kwHit(String(item.title).toLowerCase(), w)) ? 'rejected' : 'approved',
    obtain,
    category,
    name: null,
    summary: firstSentence(item.raw_text, 100),
    signup: hard ? `疑似需要：${hard}` : allowed.includes(obtain) ? null : `获取方式：${obtain}`,
    score: null,
    judged_by: 'keywords',
  };
}

// 智能审核：关键词判定把握大的直接定，只有拿不准的才交给 AI
// 自动通过：标题明确写了免费、归得进分类、获取方式是直接白嫖、没有复杂注册和价格 / 抽奖 / 推广这类存疑字样
const DOUBT = /抽奖|开奖|转发|付费|充值|折扣|打折|优惠码|优惠券|半价|首月|首年|低至|特价|促销|秒杀|续费|年付|月付|季付|限量|名额|内测资格|邀请码|aff|推广|广告|招聘|求助|请问|求推荐|有没有|怎么|吗[？?]?$|[？?]$|[$¥￥]\s?\d|\d+(\.\d+)?\s*(元|美元|欧元|rmb|usd)(?![a-z])/i;
export function triage(item, s) {
  const h = heuristicJudge(item, s);
  if (isInfoCat(h.category) && item.hint === h.category) return { verdict: h, sure: true };
  const title = String(item.title || '').toLowerCase();
  const text = `${title} ${String(item.raw_text || '').slice(0, 400).toLowerCase()}`;
  if (h.status === 'approved' && h.obtain === 'free' && !DOUBT.test(title) && !DOUBT.test(String(item.raw_text || '').slice(0, 200))) return { verdict: { ...h, score: 70, judged_by: 'auto' }, sure: true };
  // 自动拒绝：明确要付费、或者完全不像资源帖（求助 / 提问）
  if (h.obtain === 'paid' && !lines(s.free_keywords).some((w) => kwHit(text, w))) return { verdict: { ...h, status: 'rejected', judged_by: 'auto' }, sure: true };
  if (/^(求|请问|问下|有没有|求助)|[？?]\s*$/.test(String(item.title || '').trim())) return { verdict: { ...h, status: 'rejected', signup: '提问帖', judged_by: 'auto' }, sure: true };
  return { verdict: h, sure: false };
}

// ---------- 主流程：拆成小步骤 ----------
// Workers 免费版每次调用只有 10ms CPU、50 个外部请求，一次跑完全部数据源会超限。
// 所以一次“抓取”被拆成若干步骤存进 D1（jobs 表）：每个数据源 / 搜索引擎 / AI 判定批次 / 清理 / 推送各一步，
// 定时任务每分钟执行一步（steps_per_tick 可调），后台“立即抓取”由浏览器逐步驱动。

const ZERO_STATS = () => ({ auto: 0, cached: 0, dead: 0, watched: 0, skipped_src: 0, merged: 0, fetched: 0, blocked: 0, block_rule: 0, noise: 0, dup_title: 0, non_zh: 0, hard_signup: 0, too_old: 0, undated: 0, off_topic: 0, candidates: 0, new: 0, trusted: 0, judged: 0, approved: 0, rejected: 0, expired_removed: 0, errors: 0 });
// AI 可选：开关没关、且接口地址 / Key / 模型都填了才用
const aiReadyOf = (s) => s.ai_enabled !== 'false' && !!(s.ai_api_key && s.ai_base_url && s.ai_model);

function ctxOf(s, now) {
  const maxAgeDays = Math.max(1, Number(s.max_age_days) || 180);
  const cats = enabledCats(s);
  return {
    s, now, maxAgeDays, cats,
    cutoff: now - maxAgeDays * DAY,
    keepUndated: s.keep_undated === 'true',
    topicRe: compileWords([...topicWordsFor(cats), ...lines(s.topic_keywords)]),
    freeWords: lines(s.free_keywords),
    hardWords: lines(s.hard_signup_keywords),
    blockDomains: lines(s.search_block_domains),
    searchLang: s.search_lang || 'zh_first',
    blockRules: compileBlockRules(s.block_rules),
    noiseOn: s.noise_filter !== 'false',
    noEnglish: s.filter_english !== 'false',
    aiReady: aiReadyOf(s),
  };
}

function listSources(s, aiReady, log) {
  let sources = [];
  try { sources = JSON.parse(s.sources).filter((x) => x && x.enabled !== false); } catch (e) { log.push(`✗ 数据源 JSON 解析失败：${e.message}`); }
  const skipped = sources.filter((x) => x.ai_only && !aiReady);
  if (skipped.length) log.push(`– 未配置 AI，跳过 ${skipped.length} 个噪音较大的源（${skipped.map((x) => x.name).join('、')}）`);
  return sources.filter((x) => !(x.ai_only && !aiReady));
}

const RADAR_SKIP = /怎么选|如何选|对比|评测|常见问题|差多少|该不该|是什么|有哪些|哪个好|值得|吗[？?]?\s*$|[？?]\s*$|速率限制|限制详解|使用限制|教程|入门|#shorts|\br\/\w+|套餐\s*[|｜]|pricing|价格/i;
/** 过滤一批抓到的条目并入库（去重靠 seen 表，跨步骤、跨天都有效） */
async function ingest(env, c, src, items, stats, log) {
  const cats = c.cats;
  const autoCat = src.category === 'auto';
  if (src.trusted && src.category && !autoCat && !cats.includes(src.category)) { log.push(`– ${src.name}: 分类「${CAT_MAP[src.category]?.label}」未勾选，跳过`); return; }
  // 来源的分类管控：cats 限定这个源只收哪些分类
  const own = csv(src.cats);
  const allow = own.length ? cats.filter((k) => own.includes(k)) : cats;
  if (own.length && !allow.length) { log.push(`– ${src.name}: 负责的分类都没有勾选，跳过`); return; }
  if (src.trusted && src.category && !autoCat && own.length && !allow.includes(src.category)) { log.push(`– ${src.name}: 固定分类不在它负责的分类里，跳过`); return; }
  // 按 feed 的 <category> 标签筛：tags 命中其一才收，skip_tags 命中就丢
  const wantTags = csv(src.tags), skipTags = csv(src.skip_tags);
  // 一步最多处理 60 条（大的 feed 动辄上百条，全处理容易超出免费版 CPU）
  if (items.length > 30) items = items.slice(0, 30);
  if (wantTags.length || skipTags.length) items = items.filter((x) => { const t = x.tags || []; if (wantTags.length && !t.some((y) => wantTags.includes(y))) { stats.off_topic++; return false; } if (skipTags.some((y) => t.includes(y))) { stats.off_topic++; return false; } return true; });
  let include = null;
  if (src.include) { try { include = new RegExp(src.include, 'i'); } catch { log.push(`! ${src.name}: include 正则无效`); } }
  const candidates = new Map();
  const runFp = new Map();
  // 资讯类源每次只取最新的 limit 条
  if (Number(src.limit) > 0) items = items.slice().sort((a, b) => (b.published_at || 0) - (a.published_at || 0)).slice(0, Number(src.limit));
  for (const raw of items) {
    const it = { ...raw, source: raw.source || src.name || src.type, trusted: !!src.trusted, category: src.category || null, cats: own.length ? allow.join(',') : null, hint: src.hint || src.fallback || null };
    if (src.note && !it.summary) it.summary = src.note;
    it.title = cleanTitle(it.title, it.source, it.url);
    if (autoCat) {
      // 自动归类：按关键词归到已勾选的分类，归不进去就用 fallback，fallback 也没勾选则跳过
      const g = guessCategory(`${it.title} ${it.raw_text || ''}`.toLowerCase(), allow) || src.fallback;
      if (!g || !allow.includes(g)) { stats.off_topic++; continue; }
      it.category = g;
    }
    stats.fetched++;
    if (!it.url || !it.title) continue;
    if (include && !include.test(it.title)) { stats.off_topic++; continue; }
    // 搜索结果本身就是按“最近”查的，部分后端（如 AnySearch）不给发布日期，放行交给后续过滤和判定
    if (!it.published_at) { if (!c.keepUndated && !src.isSearch) { stats.undated++; continue; } }
    else if (it.published_at < c.cutoff) { stats.too_old++; continue; }
    if (isBlocked(it.url, c.blockDomains)) { stats.blocked++; continue; }
    if (c.noiseOn && isNoiseTitle(it.title)) { stats.noise++; continue; }
    // 默认过滤纯英文内容：标题、简介、正文前 500 字都没有中文就丢弃
    if (c.noEnglish && !CJK.test(it.title) && !CJK.test(it.summary || '') && !CJK.test(String(it.raw_text || '').slice(0, 500))) { stats.non_zh++; continue; }
    if (c.blockRules.length && matchBlock(c.blockRules, `${it.title}\n${it.raw_text || ''}`)) { stats.block_rule++; continue; }
    // AI 福利雷达：只要「有福利」的消息，选购指南、对比、问答这类常青文章不要
    if (src.radar && RADAR_SKIP.test(it.title)) { stats.off_topic++; continue; }
    if (src.isSearch) {
      // 搜索来的条目质量参差：标题里必须有免费类字样（search_strict）
      if (c.s.search_strict !== 'false' && !c.freeWords.some((w) => kwHit(it.title.toLowerCase(), w))) { stats.off_topic++; continue; }
      // 联网搜索结果额外过滤：语言 + 明显的复杂注册
      const zh = it.lang ? it.lang.startsWith('zh') : CJK.test(it.title);
      if (c.searchLang === 'zh_only' && !zh) { stats.non_zh++; continue; }
      const t = `${it.title} ${it.raw_text || ''}`.toLowerCase();
      if (c.s.simple_signup_only !== 'false' && c.hardWords.some((w) => t.includes(w) && !t.includes('无需' + w) && !t.includes('不需要' + w) && !t.includes('no ' + w))) { stats.hard_signup++; continue; }
    }
    if (src.filter !== false && !src.trusted) {
      const text = `${it.title} ${it.raw_text || ''}`.toLowerCase();
      if (!(c.topicRe && c.topicRe.test(text)) || !containsAny(text, c.freeWords)) { stats.off_topic++; continue; }
      // 限定了分类的源：关键词明确归到别的分类就丢弃（归不了类的交给判定）
      if (own.length) { const g = guessCategory(text, cats); if (g && !allow.includes(g)) { stats.off_topic++; continue; } }
    }
    const url = normalizeUrl(it.url);
    const id = await hashId(url);
    const fp = titleFingerprint(it.title);
    if (candidates.has(id)) continue;
    // 目标链接相同（TG 转发的博客文章、正文里指向同一个地址），或标题几乎一样：合并成一条，记下其它来源
    const tkey = targetKey(it.target || url);
    const twin = (fp.length >= 8 && runFp.get(fp)) || [...candidates.values()].find((x) => x.tkey === tkey || (x.target && targetKey(x.url) === tkey));
    if (twin) { twin.also = mergeSources(twin.also || [], [{ n: it.source, u: url }]); stats.merged++; continue; }
    const cand = { ...it, url, id, fp, tkey };
    if (fp.length >= 8) runFp.set(fp, cand);
    candidates.set(id, cand);
  }
  stats.candidates += candidates.size;
  if (!candidates.size) return;

  const ids = [...candidates.keys()];
  const existing = new Set();
  const existingFp = new Set();
  for (let i = 0; i < ids.length; i += 45) {
    const chunk = ids.slice(i, i + 45);
    const fps = chunk.map((id) => candidates.get(id).fp || '-');
    const { results: rows } = await env.DB.prepare(
      `SELECT id, fp FROM seen WHERE id IN (${chunk.map(() => '?').join(',')}) OR fp IN (${fps.map(() => '?').join(',')})`
    ).bind(...chunk, ...fps).all();
    for (const row of rows || []) { existing.add(row.id); if (row.fp) existingFp.add(row.fp); }
  }
  // 库里已有同一目标链接的条目：把来源追加过去，不再新建
  const byTarget = new Map();
  const byFp = new Map();
  const tkeys = [...new Set([...candidates.values()].flatMap((x) => [x.tkey, targetKey(x.url)]))];
  for (let i = 0; i < tkeys.length; i += 90) {
    const chunk = tkeys.slice(i, i + 90);
    const { results: rows } = await env.DB.prepare(`SELECT id, target, source, url, sources FROM items WHERE target IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).all();
    for (const row of rows || []) if (!byTarget.has(row.target)) byTarget.set(row.target, row);
  }
  const fpList = [...new Set([...candidates.values()].map((x) => x.fp).filter((f) => f && f.length >= 8))];
  for (let i = 0; i < fpList.length; i += 90) {
    const chunk = fpList.slice(i, i + 90);
    const { results: rows } = await env.DB.prepare(`SELECT id, fp, target, source, url, sources FROM items WHERE fp IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).all();
    for (const row of rows || []) if (!byFp.has(row.fp)) byFp.set(row.fp, row);
  }
  const today = dayOf(c.now);
  const stmts = [];
  for (const [id, it] of candidates) {
    if (it.upsert) {
      // 节点订阅这类“一个仓库一条”的条目：有新提交就刷新时间和说明，没变化就不动
      stats.new += existing.has(id) ? 0 : 1;
      stmts.push(
        env.DB.prepare(`INSERT INTO items (id, title, url, source, raw_text, published_at, fetched_at, status, fp, day, category, name, summary, obtain, score, judged_by, judged_at, target, extra) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', NULL, ?, ?, ?, ?, 'free', 80, 'trusted', ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET title = excluded.title, summary = excluded.summary, extra = excluded.extra, published_at = excluded.published_at, fetched_at = excluded.fetched_at, judged_at = excluded.judged_at, day = excluded.day, status = 'approved' WHERE items.published_at IS NOT excluded.published_at OR items.extra IS NOT excluded.extra`)
          .bind(id, it.title.slice(0, 500), it.url, it.source || '', (it.raw_text || '').slice(0, 2000), it.published_at || c.now, c.now, today, it.category, it.name || null, it.summary || null, c.now, it.tkey, JSON.stringify(it.extra || {})),
        env.DB.prepare('INSERT OR IGNORE INTO seen (id, fp, seen_at) VALUES (?, ?, ?)').bind(id, null, c.now)
      );
      continue;
    }
    if (existing.has(id)) continue;
    const prev = byTarget.get(it.tkey) || byTarget.get(targetKey(it.url)) || (it.fp && it.fp.length >= 8 ? byFp.get(it.fp) : null);
    if (prev && prev.id !== id) {
      let list = [];
      try { list = JSON.parse(prev.sources || '[]'); } catch {}
      list = mergeSources(list, [{ n: it.source, u: it.url }, ...(it.also || [])].filter((x) => x.u !== prev.url));
      prev.sources = JSON.stringify(list);
      stmts.push(env.DB.prepare('UPDATE items SET sources = ? WHERE id = ?').bind(prev.sources, prev.id), env.DB.prepare('INSERT OR IGNORE INTO seen (id, fp, seen_at) VALUES (?, ?, ?)').bind(id, it.fp || null, c.now));
      stats.merged++;
      continue;
    }
    if (it.fp && it.fp.length >= 8 && existingFp.has(it.fp)) { stats.dup_title++; continue; } // 同标题的旧条目已被清理，只剩去重记录
    stats.new++;
    // 截止时间、兑换码：从标题和正文里提取
    const blob = `${it.title}\n${it.summary || ''}\n${it.raw_text || ''}`;
    const exp = extractDeadline(blob, it.published_at, c.now);
    const codes = extractCodes(blob);
    const ex0 = codes.length ? { codes } : {};
    if (it.trusted && (it.category === 'ai' || it.category === 'aideal')) { const txt = `${it.name || ''} ${it.title} ${it.summary || ''} ${String(it.raw_text || '').slice(0, 300)}`; ex0.vendor = guessVendor(it.name || it.title) || guessVendor(txt) || undefined; ex0.perk = guessPerk(txt) || undefined; }
    const extra = Object.keys(ex0).some((k) => ex0[k] !== undefined) ? JSON.stringify(ex0) : null;
    // 白嫖专源直接通过，不消耗 AI 额度
    const direct = it.trusted && it.category;
    if (direct && isInfoCat(it.category) && !it.summary) it.summary = firstSentence(it.raw_text, 90);
    if (direct) { stats.trusted++; stats.approved++; }
    stmts.push(
      direct
        ? env.DB.prepare('INSERT OR IGNORE INTO items (id, title, url, source, raw_text, published_at, fetched_at, status, fp, day, category, name, summary, signup, obtain, score, judged_by, judged_at, target, sources, expires_at, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(id, it.title.slice(0, 500), it.url, it.source || '', (it.raw_text || '').slice(0, 2000), it.published_at || null, c.now, 'approved', it.fp || null, today, it.category, it.name || null, it.summary || firstSentence(it.raw_text, 100), it.signup || null, isInfoCat(it.category) ? null : 'free', 80, 'trusted', c.now, it.tkey, it.also ? JSON.stringify(it.also) : null, exp, extra)
        : env.DB.prepare('INSERT OR IGNORE INTO items (id, title, url, source, raw_text, published_at, fetched_at, status, fp, day, cats, hint, target, sources, expires_at, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(id, it.title.slice(0, 500), it.url, it.source || '', (it.raw_text || '').slice(0, 2000), it.published_at || null, c.now, 'pending', it.fp || null, today, it.cats || null, it.hint || null, it.tkey, it.also ? JSON.stringify(it.also) : null, exp, extra),
      env.DB.prepare('INSERT OR IGNORE INTO seen (id, fp, seen_at) VALUES (?, ?, ?)').bind(id, it.fp || null, c.now)
    );
  }
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
}

/** 判定一批待处理条目。返回是否还有剩余 */
async function judgeStep(env, c, stats, log, judgedSoFar, capOverride) {
  const s = c.s;
  const perStep = c.aiReady ? Math.min(20, Math.max(1, Number(s.ai_batch_size) || 12)) * 3 : 15;
  const cap = c.aiReady ? (capOverride || Math.max(1, Number(s.ai_max_items) || 60)) : 100000;
  const room = Math.max(0, cap - judgedSoFar);
  if (!room) { log.push(`– 本次 AI 判定已达上限 ${cap} 条，剩余留到下次`); return false; }
  const { results: pending } = await env.DB.prepare(
    'SELECT * FROM items WHERE status = ? AND (published_at IS NULL OR published_at >= ?) ORDER BY published_at DESC LIMIT ?'
  ).bind('pending', c.cutoff, Math.min(perStep, room) + 1).all();
  const list = (pending || []).slice(0, Math.min(perStep, room));
  if (!list.length) return false;

  const updates = [];
  const applyVerdict = (it, v) => {
    // AI 给的截止日期 / 领取方式：补进 expires_at 和 extra.how
    let ex = null;
    try { ex = it.extra ? JSON.parse(it.extra) : null; } catch {}
    if (v.how) ex = { ...(ex || {}), how: String(v.how).slice(0, 40) };
    // AI 福利：记下厂商和福利类型（AI 给的优先，没有就按标题猜）
    if (v.status === 'approved' && (v.category === 'ai' || v.category === 'aideal')) {
      const txt = `${v.name || ''} ${it.title} ${v.summary || ''}`;
      ex = { ...(ex || {}), vendor: String(v.vendor || guessVendor(it.title) || guessVendor(txt) || '').slice(0, 24) || undefined, perk: String(v.perk || guessPerk(txt) || '').slice(0, 8) || undefined };
    }
    const exp = v.expires_at || it.expires_at || null;
    updates.push(
      env.DB.prepare('UPDATE items SET status=?, category=?, name=?, summary=?, signup=?, score=?, obtain=?, judged_by=?, judged_at=?, expires_at=?, extra=? WHERE id=?')
        .bind(v.status, v.category, v.name, v.summary, v.signup, v.score, v.obtain || null, v.judged_by, Date.now(), exp, ex ? JSON.stringify(ex) : null, it.id)
    );
    stats.judged++;
    if (v.status === 'approved') stats.approved++; else stats.rejected++;
  };

  if (c.aiReady) {
    const minScore = Number(s.ai_min_score) || 60;
    const allowedObtain = lines(s.allowed_obtain);
    const batchSize = Math.min(20, Math.max(1, Number(s.ai_batch_size) || 12));
    let aiItems = list.filter((it) => it.attempts < 3);
    for (const it of list.filter((x) => x.attempts >= 3)) applyVerdict(it, heuristicJudge(it, s));
    if (s.ai_review !== 'all' && !capOverride) { // 「用 AI 重新判定」时全部交给 AI
      const rest = [];
      // AI 福利雷达搜来的条目鱼龙混杂，配了 AI 就都交给 AI 细审
      for (const it of aiItems) { const t = triage(it, s); if (t.sure && !String(it.source || '').startsWith('AI 福利雷达')) { applyVerdict(it, t.verdict); stats.auto++; } else rest.push(it); }
      aiItems = rest;
    }
    // 同一个目标地址之前已经让 AI 判过：直接复用结论，不重复花额度
    const useCache = s.ai_cache !== 'false' && !capOverride; // 「重新判定」不走缓存
    if (useCache && aiItems.length) {
      const keys = [...new Set(aiItems.map((it) => it.target).filter(Boolean))];
      const hit = new Map();
      for (let i = 0; i < keys.length; i += 90) {
        const chunk = keys.slice(i, i + 90);
        const { results: rows } = await env.DB.prepare(`SELECT k, v FROM verdicts WHERE k IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).all();
        for (const r of rows || []) { try { hit.set(r.k, JSON.parse(r.v)); } catch {} }
      }
      if (hit.size) {
        const rest = [];
        for (const it of aiItems) { const v = it.target && hit.get(it.target); if (v) { applyVerdict(it, { ...v, judged_by: 'cache' }); stats.cached = (stats.cached || 0) + 1; } else rest.push(it); }
        aiItems = rest;
      }
    }
    // 用户投了「不值」的条目：作为反例告诉 AI
    let bad = [];
    if (aiItems.length) {
      const { results: rows } = await env.DB.prepare('SELECT title FROM items WHERE down >= 2 AND down > up ORDER BY judged_at DESC LIMIT 6').all().catch(() => ({ results: [] }));
      bad = (rows || []).map((r) => r.title);
    }
    const cacheWrites = [];
    const batches = [];
    for (let i = 0; i < aiItems.length; i += batchSize) batches.push(aiItems.slice(i, i + batchSize));
    await Promise.all(batches.map(async (batch) => {
      try {
        const verdicts = await judgeBatch(batch, s, bad);
        batch.forEach((it, idx) => {
          const v = verdicts.get(idx);
          if (!v) { updates.push(env.DB.prepare('UPDATE items SET attempts = attempts + 1 WHERE id=?').bind(it.id)); return; }
          const score = Math.round(Number(v.score) || 0);
          const obtain = ['free', 'conditional', 'lottery', 'trial', 'promo', 'paid'].includes(v.obtain) ? v.obtain : guessObtain(it.title, it.raw_text || '');
          const allow = allowedOf(it, c.cats);
          let category = allow.includes(v.category) ? v.category : 'other';
          // AI 没归类但来源有默认分类：用默认分类
          if (category === 'other' && (!v.category || v.category === 'other') && it.hint && allow.includes(it.hint)) category = it.hint;
          const signupOk = s.simple_signup_only === 'false' || v.simple_signup === true;
          const ok = v.relevant === true && signupOk && category !== 'other' && score >= minScore && (isInfoCat(category) || allowedObtain.includes(obtain) || (category === 'aideal' && obtain === 'trial'));
          const dl = /^(20\d{2})-(\d{2})-(\d{2})$/.exec(String(v.deadline || ''));
          const expires_at = dl ? Date.UTC(+dl[1], +dl[2] - 1, +dl[3], 15, 59, 59) : null; // 北京时间当天 23:59:59
          const verdict = {
            status: ok ? 'approved' : 'rejected',
            category,
            name: v.name ? String(v.name).slice(0, 100) : null,
            summary: v.summary ? String(v.summary).slice(0, 300) : null,
            signup: v.signup ? String(v.signup).slice(0, 100) : null,
            score,
            obtain,
            judged_by: `ai:${s.ai_model}`,
            how: v.how ? String(v.how).slice(0, 40) : null,
            vendor: v.vendor && v.vendor !== 'null' ? String(v.vendor).slice(0, 24) : null,
            perk: v.perk && v.perk !== 'null' ? String(v.perk).slice(0, 8) : null,
            expires_at: expires_at && expires_at > Date.now() - 30 * DAY && expires_at < Date.now() + 400 * DAY ? expires_at : null,
          };
          applyVerdict(it, verdict);
          if (s.ai_cache !== 'false' && it.target) cacheWrites.push(env.DB.prepare('INSERT INTO verdicts (k, v, at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, at = excluded.at').bind(it.target, JSON.stringify({ ...verdict, judged_by: undefined }), Date.now()));
        });
      } catch (e) {
        stats.errors++;
        log.push(`✗ AI 判定失败：${e.message}`);
        for (const it of batch) updates.push(env.DB.prepare('UPDATE items SET attempts = attempts + 1 WHERE id=?').bind(it.id));
      }
    }));
    updates.push(...cacheWrites);
  } else {
    for (const it of list) applyVerdict(it, heuristicJudge(it, s));
  }
  for (let i = 0; i < updates.length; i += 50) await env.DB.batch(updates.slice(i, i + 50));
  return (pending || []).length > list.length || (c.aiReady && list.length === perStep);
}

async function cleanupStep(env, c, stats) {
  const keepMs = Math.max(1, Number(c.s.retention_days) || 15) * DAY;
  const del = await env.DB.prepare('DELETE FROM items WHERE fetched_at < ? OR (published_at IS NOT NULL AND published_at < ?)').bind(c.now - keepMs, c.cutoff).run();
  stats.expired_removed += del.meta?.changes || 0;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM seen WHERE seen_at < ?').bind(Math.min(c.cutoff, c.now - keepMs)),
    env.DB.prepare('DELETE FROM verdicts WHERE at < ?').bind(c.cutoff),
    env.DB.prepare('DELETE FROM votes WHERE at < ?').bind(c.now - keepMs - 7 * DAY),
    env.DB.prepare('DELETE FROM src_health WHERE day < ?').bind(dayOf(c.now - 30 * DAY)),
    env.DB.prepare("DELETE FROM rate WHERE reset < ?").bind(c.now),
    env.DB.prepare('DELETE FROM jobs WHERE run_id IN (SELECT id FROM runs WHERE started_at < ?)').bind(c.now - 2 * DAY),
    env.DB.prepare('DELETE FROM runs WHERE started_at < ?').bind(c.now - keepMs),
  ]);
}

// ---------- 失效检测：抽查已收录的链接，404 / 410 或页面标题写着已结束的，标记为疑似失效 ----------
const DEAD_RE = /活动已结束|活动结束|已结束|已失效|已下架|已领完|已抢光|已售罄|已停止|已关闭注册|停止注册|页面不存在|帖子不存在|主题不存在|内容已删除|已被删除|404 not found|page not found|has ended|giveaway ended|offer expired|no longer available|expired/i;
const SKIP_CHECK = /(^|\.)(t\.me|telegram\.me|github\.com|raw\.githubusercontent\.com|store\.epicgames\.com|reddit\.com|x\.com|twitter\.com)$/i;
export async function checkLink(url) {
  let host = '';
  try { host = new URL(url).hostname; } catch { return null; }
  if (SKIP_CHECK.test(host)) return null;
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(10000) });
    if (r.status === 404 || r.status === 410) { r.body?.cancel().catch(() => {}); return 1; }
    if (!r.ok || !/html/i.test(r.headers.get('content-type') || '')) { r.body?.cancel().catch(() => {}); return null; } // 403 / 5xx：多半是拦了机房 IP，不算失效
    const reader = r.body.getReader();
    let html = '', size = 0;
    while (size < 30000) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; html += new TextDecoder().decode(value, { stream: true }); }
    reader.cancel().catch(() => {});
    // 只看标题、描述和第一个 h1，正文评论里的「已结束」不算
    const pick = [/<title[^>]*>([\s\S]{0,300}?)<\/title>/i, /<meta[^>]+(?:name|property)=["'](?:description|og:title|og:description)["'][^>]+content=["']([^"']{0,300})/i, /<h1[^>]*>([\s\S]{0,300}?)<\/h1>/i].map((re) => (re.exec(html) || [])[1] || '').join(' ');
    return DEAD_RE.test(cleanText(pick)) ? 1 : 0;
  } catch { return null; }
}
async function checkStep(env, c, stats, log) {
  if (c.s.link_check === 'false') return false;
  const n = Math.min(30, Math.max(1, Number(c.s.link_check_per_run) || 12));
  const info = Object.keys(CAT_MAP).filter((k) => isInfoCat(k));
  const { results: rows } = await env.DB.prepare(
    `SELECT id, url FROM items WHERE status = 'approved' AND (checked_at IS NULL OR checked_at < ?) AND (category IS NULL OR category NOT IN (${info.map(() => '?').join(',')})) ORDER BY checked_at IS NOT NULL, checked_at, published_at DESC LIMIT ?`
  ).bind(c.now - 3 * DAY, ...info, n).all();
  if (!rows?.length) return false;
  const res = await Promise.all(rows.map((r) => checkLink(r.url)));
  const now = Date.now();
  await env.DB.batch(rows.map((r, i) => env.DB.prepare('UPDATE items SET checked_at = ?, dead = CASE WHEN ? IS NULL THEN dead ELSE ? END WHERE id = ?').bind(now, res[i], res[i] ?? 0, r.id)));
  const dead = res.filter((x) => x === 1).length;
  stats.dead += dead;
  log.push(`✓ 失效检测：抽查 ${rows.length} 条，${dead} 条疑似失效，${res.filter((x) => x === null).length} 条打不开（不计入）`);
  return false;
}

// ---------- 关键词提醒：新通过的条目命中关键词就单独推送 ----------
async function watchStep(env, c, stats, log) {
  const s = c.s;
  const kws = lines(s.watch_keywords);
  if (s.watch_enabled === 'false' || !kws.length) return false;
  const since = Number(await getMeta(env, 'watch_last')) || c.now - DAY;
  const now = Date.now();
  const { results: rows } = await env.DB.prepare("SELECT id, title, name, summary, url, category, obtain, expires_at FROM items WHERE status = 'approved' AND judged_at > ? ORDER BY judged_at DESC LIMIT 300").bind(since).all();
  await setMeta(env, 'watch_last', now);
  const hits = [];
  for (const r of rows || []) {
    const t = `${r.name || ''} ${r.title} ${r.summary || ''}`.toLowerCase();
    const k = kws.find((w) => kwHit(t, w));
    if (k) hits.push({ ...r, summary: `【${k}】${r.summary || ''}` });
  }
  if (!hits.length) return false;
  stats.watched += hits.length;
  try {
    const r = await deliver(env, s, { kind: 'alert', title: `关键词提醒：${[...new Set(hits.map((h) => /^【([^】]+)】/.exec(h.summary)[1]))].join('、')}（${hits.length} 条）`, items: hits.slice(0, 20) });
    log.push(r.skipped ? `– 关键词提醒：${r.skipped}` : `✓ 关键词提醒：${hits.length} 条 → ${r.providers.join(' + ')}${r.errors.length ? '\n✗ ' + r.errors.join('\n✗ ') : ''}`);
  } catch (e) { log.push(`✗ 关键词提醒发送失败：${e.message}`); }
  return false;
}

const STEP_LABEL = { source: '抓取', search: '搜索', radar: 'AI 福利雷达', judge: '判定', cleanup: '清理', mail: '推送', check: '失效检测', watch: '关键词提醒' };

/** 新建一次运行（已有进行中的运行则直接返回它） */
export async function planRun(env, trigger = 'cron', opts = {}) {
  const now = Date.now();
  const active = await env.DB.prepare('SELECT id, started_at FROM runs WHERE finished_at IS NULL ORDER BY id DESC LIMIT 1').first();
  if (active && now - active.started_at < 3 * 3600000) return { run_id: active.id, existing: true };
  if (active) await env.DB.prepare("UPDATE runs SET finished_at = ?, log = log || ? WHERE id = ?").bind(now, '\n✗ 超时未完成，已放弃', active.id).run();

  const s = await getSettings(env);
  const log = [];
  const aiReady = aiReadyOf(s);
  let sources = listSources(s, aiReady, log);
  // 错峰：设置了 every（小时）的源，距上次成功抓取不到这么久就跳过这一轮（手动抓取不跳过）
  if (trigger !== 'manual' && sources.some((x) => Number(x.every) > 0)) {
    const { results: rows } = await env.DB.prepare('SELECT name, MAX(last_at) AS t FROM src_health GROUP BY name').all();
    const last = Object.fromEntries((rows || []).map((r) => [r.name, r.t || 0]));
    const skip = sources.filter((x) => Number(x.every) > 0 && now - (last[x.name] || 0) < Number(x.every) * 3600000 - 30 * 60000);
    if (skip.length) { log.push(`– 错峰：${skip.length} 个源还没到抓取间隔，这一轮跳过`); sources = sources.filter((x) => !skip.includes(x)); }
  }
  const steps = opts.only === 'judge' ? [] : sources.map((src) => ['source', { src }]);
  if (opts.only === 'judge') {
    steps.push(['judge', { cap: opts.cap || 0 }]); // 只重新判定，不抓取
  } else {
    // 可用的搜索后端并行跑；单次调用外部请求上限 50，按每步最多 40 个请求分组
    const ready = BACKENDS.filter((b) => backendReady(s, b)).map((b) => b.id);
    const perBackend = Math.max(1, Number(s.search_max_queries) || 8);
    const group = 1; // 每步只跑一家搜索后端，控制单步 CPU（免费版 10ms）
    for (let i = 0; i < ready.length; i += group) steps.push(['search', { engines: ready.slice(i, i + group) }]);
    // AI 福利雷达：AI 两个分类有勾选、且有可用的搜索后端时，单独跑一步（最多 2 家）
    const cats = enabledCats(s);
    if (s.aifree_radar !== 'false' && ready.length && (cats.includes('ai') || cats.includes('aideal'))) for (const id of ready.slice(0, 2)) steps.push(['radar', { engines: [id] }]);
    steps.push(['judge', {}], ['cleanup', {}], ['check', {}], ['watch', {}]);
  }
  if (!aiReady) log.push('未配置 AI，使用关键词判定');

  const r = await env.DB.prepare('INSERT INTO runs (trigger, started_at, finished_at, stats, log) VALUES (?, ?, NULL, ?, ?) RETURNING id')
    .bind(trigger, now, JSON.stringify(ZERO_STATS()), log.join('\n')).first();
  const runId = r.id;
  const stmts = steps.map(([kind, payload], i) =>
    env.DB.prepare("INSERT INTO jobs (run_id, seq, kind, payload, status) VALUES (?, ?, ?, ?, 'pending')").bind(runId, i, kind, JSON.stringify(payload)));
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  return { run_id: runId, steps: steps.length };
}

async function runJob(env, job, c, stats, log, runStats) {
  const p = JSON.parse(job.payload || '{}');
  switch (job.kind) {
    case 'source': {
      const src = p.src;
      const day = dayOf(Date.now());
      try {
        const items = await fetchSource(src, c.cutoff, env);
        log.push(`✓ ${src.name}: ${items.length} 条`);
        await ingest(env, c, src, items, stats, log);
        // 来源健康：按天记抓到多少、新增多少、失败几次
        await env.DB.prepare('INSERT INTO src_health (name, day, fetched, added, errors, last_at) VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT(name, day) DO UPDATE SET fetched = fetched + excluded.fetched, added = added + excluded.added, last_at = excluded.last_at')
          .bind(src.name || src.type, day, items.length, stats.new, Date.now()).run();
      } catch (e) {
        stats.errors++; log.push(`✗ ${src.name}: ${e.message}`);
        await env.DB.prepare('INSERT INTO src_health (name, day, errors, last_err) VALUES (?, ?, 1, ?) ON CONFLICT(name, day) DO UPDATE SET errors = errors + 1, last_err = excluded.last_err')
          .bind(src.name || src.type, day, String(e.message).slice(0, 200)).run().catch(() => {});
      }
      return false;
    }
    case 'search': {
      const ids = p.engines || [p.engine];
      const results = await Promise.all(ids.map((id) => runBackend(c.s, id, c.maxAgeDays).then((r) => ({ id, r }), (e) => ({ id, e }))));
      for (const { id, r, e } of results) {
        const name = (BACKEND_MAP[id]?.name || id) + ' 搜索';
        if (e) { stats.errors++; log.push(`✗ ${name}: ${e.message}`); continue; }
        for (const x of r.errors) log.push(`! ${name} 部分查询失败：${x}`);
        if (r.skipped) { log.push(`– ${name}: ${r.skipped}`); continue; }
        log.push(`✓ ${name}: ${r.items.length} 条`);
        await ingest(env, c, { name, isSearch: true, cats: c.s[`${id}_cats`] ? backendCats(c.s, id) : null }, r.items, stats, log);
      }
      return false;
    }
    case 'radar': {
      const round = Number(await getMeta(env, 'radar_round')) || 0;
      await setMeta(env, 'radar_round', round + 1);
      const queries = radarQueries(c.s, round);
      const days = Math.min(c.maxAgeDays, Math.max(1, Number(c.s.aifree_days) || 30));
      const allow = ['ai', 'aideal'].filter((k) => c.cats.includes(k));
      const results = await Promise.all((p.engines || []).map((id) => runBackend({ ...c.s, search_queries: queries.join('\n'), search_lang: 'any', search_max_queries: String(queries.length), [`${id}_cats`]: allow.join(',') }, id, days).then((r) => ({ id, r }), (e) => ({ id, e }))));
      for (const { id, r, e } of results) {
        const name = 'AI 福利雷达 · ' + (BACKEND_MAP[id]?.name || id);
        if (e) { stats.errors++; log.push(`✗ ${name}: ${e.message}`); continue; }
        for (const x of r.errors) log.push(`! ${name} 部分查询失败：${x}`);
        log.push(`✓ ${name}: ${r.items.length} 条（${queries.join(' / ')}）`);
        for (const it of r.items) it.source = name;
        await ingest(env, c, { name, isSearch: true, radar: true, cats: allow, hint: 'aideal' }, r.items, stats, log);
      }
      return false;
    }
    case 'judge':
      return judgeStep(env, c, stats, log, Math.max(0, (runStats.judged || 0) - (runStats.auto || 0) - (runStats.cached || 0)), p.cap);
    case 'cleanup':
      await cleanupStep(env, c, stats);
      return false;
    case 'check':
      return checkStep(env, c, stats, log);
    case 'watch':
      return watchStep(env, c, stats, log);
    case 'mail': {
      try {
        const r = await sendDigest(env);
        log.push(r.skipped ? `– 推送跳过：${r.skipped}` : `✓ 已推送 ${r.sent} 条（${r.providers.join(' + ')}）→ ${r.to.join(', ')}${r.errors.length ? '\n✗ ' + r.errors.join('\n✗ ') : ''}`);
      } catch (e) { stats.errors++; log.push(`✗ 推送失败：${e.message}`); }
      return false;
    }
  }
  return false;
}

/** 执行进行中运行的下一步（最多 maxSteps 步）。返回进度 */
export async function tick(env, maxSteps = 1) {
  const run = await env.DB.prepare('SELECT * FROM runs WHERE finished_at IS NULL ORDER BY id DESC LIMIT 1').first();
  if (!run) return { idle: true };
  const s = await getSettings(env);
  const c = ctxOf(s, run.started_at);
  const runStats = { ...ZERO_STATS(), ...JSON.parse(run.stats || '{}') };
  const log = [];
  let current = null;
  let busy = false;
  for (let n = 0; n < maxSteps; n++) {
    // 原子地认领下一步：同一次运行同时只允许一个步骤在执行（定时任务和后台按钮可能同时触发）
    const t = Date.now();
    // 卡住的步骤（多半是超出 CPU 被强制结束）：重试一次，再卡就跳过，免得整轮抓取一直卡在这一步
    const stuck = await env.DB.prepare("UPDATE jobs SET status = CASE WHEN tries >= 1 THEN 'done' ELSE 'pending' END, tries = tries + 1 WHERE run_id = ? AND status = 'running' AND claimed_at < ? RETURNING kind, status, payload").bind(run.id, t - 4 * 60000).all();
    for (const j of stuck.results || []) if (j.status === 'done') { let nm = ''; try { nm = JSON.parse(j.payload || '{}').src?.name || ''; } catch {} log.push(`✗ ${STEP_LABEL[j.kind] || j.kind}${nm ? '：' + nm : ''} 两次没跑完（可能超出 CPU 限制），已跳过`); }
    const job = await env.DB.prepare(
      `UPDATE jobs SET status = 'running', claimed_at = ?1
       WHERE id = (SELECT id FROM jobs WHERE run_id = ?2 AND status = 'pending' ORDER BY seq LIMIT 1)
         AND NOT EXISTS (SELECT 1 FROM jobs WHERE run_id = ?2 AND status = 'running')
       RETURNING *`
    ).bind(t, run.id).first();
    if (!job) { busy = !!(await env.DB.prepare("SELECT 1 AS x FROM jobs WHERE run_id = ? AND status = 'running' LIMIT 1").bind(run.id).first()); break; }
    const pl = JSON.parse(job.payload || '{}');
    current = STEP_LABEL[job.kind] + (job.kind === 'source' ? '：' + (pl.src?.name || '') : job.kind === 'search' || job.kind === 'radar' ? '：' + (pl.engines || [pl.engine]).map((id) => BACKEND_MAP[id]?.name || id).join(' + ') : '');
    const stats = ZERO_STATS();
    let again = false;
    try { again = await runJob(env, job, c, stats, log, runStats); } catch (e) { stats.errors++; log.push(`✗ ${current} 出错：${e.message}`); }
    await env.DB.prepare('UPDATE jobs SET status = ? WHERE id = ?').bind(again ? 'pending' : 'done', job.id).run();
    // 统计按步骤累加写回（读最新值再加，避免和别的调用互相覆盖）
    const fresh = await env.DB.prepare('SELECT stats FROM runs WHERE id = ?').bind(run.id).first();
    const merged = { ...ZERO_STATS(), ...JSON.parse(fresh?.stats || '{}') };
    for (const k of Object.keys(stats)) merged[k] = (merged[k] || 0) + stats[k];
    Object.assign(runStats, merged);
    await env.DB.prepare('UPDATE runs SET stats = ? WHERE id = ?').bind(JSON.stringify(merged), run.id).run();
  }
  const left = await env.DB.prepare("SELECT COUNT(*) AS n, (SELECT COUNT(*) FROM jobs WHERE run_id = ?) AS total FROM jobs WHERE run_id = ? AND status != 'done'").bind(run.id, run.id).first();
  const done = !left || left.n === 0;
  const now = Date.now();
  if (done) {
    const fin = await env.DB.prepare('UPDATE runs SET finished_at = ? WHERE id = ? AND finished_at IS NULL').bind(now, run.id).run();
    if (fin.meta?.changes) log.push(`完成，用时 ${Math.max(1, Math.round((now - run.started_at) / 1000))}s`);
  }
  const add = log.join('\n');
  if (add) await env.DB.prepare("UPDATE runs SET log = CASE WHEN log = '' THEN ? ELSE log || char(10) || ? END WHERE id = ?").bind(add, add, run.id).run();
  return { run_id: run.id, done, busy, current, left: left?.n || 0, total: left?.total || 0, stats: runStats, log };
}

/** 一口气跑完（本地测试 / 付费版用）。免费版请用 tick 逐步执行 */
export async function runCrawl(env, trigger = 'manual', maxTicks = 500) {
  await planRun(env, trigger);
  let r;
  for (let i = 0; i < maxTicks; i++) { r = await tick(env, 5); if (r.idle || r.done) break; }
  const run = await env.DB.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT 1').first();
  return { stats: JSON.parse(run.stats || '{}'), log: String(run.log || '').split('\n') };
}
