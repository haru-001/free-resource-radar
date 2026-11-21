// 抓取、过滤、AI 判定的主流程
import { getSettings, lines } from './db.js';
import { judgeBatch } from './ai.js';
import { sendDigest } from './mailer.js';
import { dayOf } from './db.js';
import { CAT_MAP, enabledCats, guessCategory, topicWordsFor, kwHit, compileWords } from './categories.js';
import { BACKENDS, BACKEND_MAP, backendReady, runBackend, backendCats } from './search.js';
import { isNoiseTitle, guessObtain, compileBlockRules, matchBlock, titleFingerprint } from './rules.js';

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
    out.push({
      title: cleanText(tag(b, 'title')),
      url: link,
      published_at: parseDate(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'dc:date') || tag(b, 'updated')),
      raw_text: plain.slice(0, 1200),
    });
  }
  return out;
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
  const text = `${item.title} ${item.raw_text || ''}`.toLowerCase();
  const hard = s.simple_signup_only !== 'false' && lines(s.hard_signup_keywords).find((w) => text.includes(w));
  const obtain = guessObtain(item.title, item.raw_text || '');
  const allowed = lines(s.allowed_obtain);
  const allow = allowedOf(item, enabledCats(s));
  const category = guessCategory(text, allow) || (item.hint && allow.includes(item.hint) ? item.hint : null) || 'other';
  return {
    // 没有 AI 时更保守：标题里要有“免费 / 白嫖 / free”之类的字样
    status: hard || !allowed.includes(obtain) || category === 'other' || !lines(s.free_keywords).some((w) => kwHit(String(item.title).toLowerCase(), w)) ? 'rejected' : 'approved',
    obtain,
    category,
    name: null,
    summary: (item.raw_text || '').slice(0, 120),
    signup: hard ? `疑似需要：${hard}` : allowed.includes(obtain) ? null : `获取方式：${obtain}`,
    score: null,
    judged_by: 'keywords',
  };
}

// ---------- 主流程：拆成小步骤 ----------
// Workers 免费版每次调用只有 10ms CPU、50 个外部请求，一次跑完全部数据源会超限。
// 所以一次“抓取”被拆成若干步骤存进 D1（jobs 表）：每个数据源 / 搜索引擎 / AI 判定批次 / 清理 / 推送各一步，
// 定时任务每分钟执行一步（steps_per_tick 可调），后台“立即抓取”由浏览器逐步驱动。

const ZERO_STATS = () => ({ merged: 0, fetched: 0, blocked: 0, block_rule: 0, noise: 0, dup_title: 0, non_zh: 0, hard_signup: 0, too_old: 0, undated: 0, off_topic: 0, candidates: 0, new: 0, trusted: 0, judged: 0, approved: 0, rejected: 0, expired_removed: 0, errors: 0 });
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
  let include = null;
  if (src.include) { try { include = new RegExp(src.include, 'i'); } catch { log.push(`! ${src.name}: include 正则无效`); } }
  const candidates = new Map();
  const runFp = new Set();
  for (const raw of items) {
    const it = { ...raw, source: raw.source || src.name || src.type, trusted: !!src.trusted, category: src.category || null, cats: own.length ? allow.join(',') : null, hint: src.hint || src.fallback || null };
    if (src.note && !it.summary) it.summary = src.note;
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
    if (src.isSearch) {
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
    if (fp.length >= 8 && runFp.has(fp)) { stats.dup_title++; continue; }
    if (fp.length >= 8) runFp.add(fp);
    // 目标链接相同（比如 TG 频道转发的博客文章）：合并成一条，记下其它来源
    const tkey = targetKey(it.target || url);
    const twin = [...candidates.values()].find((x) => x.tkey === tkey);
    if (twin) { twin.also = mergeSources(twin.also || [], [{ n: it.source, u: url }]); stats.merged++; continue; }
    candidates.set(id, { ...it, url, id, fp, tkey });
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
  const tkeys = [...new Set([...candidates.values()].map((x) => x.tkey))];
  for (let i = 0; i < tkeys.length; i += 90) {
    const chunk = tkeys.slice(i, i + 90);
    const { results: rows } = await env.DB.prepare(`SELECT id, target, source, url, sources FROM items WHERE target IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).all();
    for (const row of rows || []) if (!byTarget.has(row.target)) byTarget.set(row.target, row);
  }
  const today = dayOf(c.now);
  const stmts = [];
  for (const [id, it] of candidates) {
    if (existing.has(id)) continue;
    const prev = byTarget.get(it.tkey);
    if (prev && prev.id !== id) {
      let list = [];
      try { list = JSON.parse(prev.sources || '[]'); } catch {}
      list = mergeSources(list, [{ n: it.source, u: it.url }, ...(it.also || [])].filter((x) => x.u !== prev.url));
      prev.sources = JSON.stringify(list);
      stmts.push(env.DB.prepare('UPDATE items SET sources = ? WHERE id = ?').bind(prev.sources, prev.id), env.DB.prepare('INSERT OR IGNORE INTO seen (id, fp, seen_at) VALUES (?, ?, ?)').bind(id, it.fp || null, c.now));
      stats.merged++;
      continue;
    }
    if (it.fp && it.fp.length >= 8 && existingFp.has(it.fp)) { stats.dup_title++; continue; }
    stats.new++;
    // 白嫖专源直接通过，不消耗 AI 额度
    const direct = it.trusted && it.category;
    if (direct) { stats.trusted++; stats.approved++; }
    stmts.push(
      direct
        ? env.DB.prepare('INSERT OR IGNORE INTO items (id, title, url, source, raw_text, published_at, fetched_at, status, fp, day, category, name, summary, signup, obtain, score, judged_by, judged_at, target, sources) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(id, it.title.slice(0, 500), it.url, it.source || '', (it.raw_text || '').slice(0, 2000), it.published_at || null, c.now, 'approved', it.fp || null, today, it.category, it.name || null, it.summary || (it.raw_text || '').slice(0, 120), it.signup || null, 'free', 80, 'trusted', c.now, it.tkey, it.also ? JSON.stringify(it.also) : null)
        : env.DB.prepare('INSERT OR IGNORE INTO items (id, title, url, source, raw_text, published_at, fetched_at, status, fp, day, cats, hint, target, sources) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(id, it.title.slice(0, 500), it.url, it.source || '', (it.raw_text || '').slice(0, 2000), it.published_at || null, c.now, 'pending', it.fp || null, today, it.cats || null, it.hint || null, it.tkey, it.also ? JSON.stringify(it.also) : null),
      env.DB.prepare('INSERT OR IGNORE INTO seen (id, fp, seen_at) VALUES (?, ?, ?)').bind(id, it.fp || null, c.now)
    );
  }
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
}

/** 判定一批待处理条目。返回是否还有剩余 */
async function judgeStep(env, c, stats, log, judgedSoFar, capOverride) {
  const s = c.s;
  const perStep = c.aiReady ? Math.min(20, Math.max(1, Number(s.ai_batch_size) || 12)) * 3 : 40;
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
    updates.push(
      env.DB.prepare('UPDATE items SET status=?, category=?, name=?, summary=?, signup=?, score=?, obtain=?, judged_by=?, judged_at=? WHERE id=?')
        .bind(v.status, v.category, v.name, v.summary, v.signup, v.score, v.obtain || null, v.judged_by, Date.now(), it.id)
    );
    stats.judged++;
    if (v.status === 'approved') stats.approved++; else stats.rejected++;
  };

  if (c.aiReady) {
    const minScore = Number(s.ai_min_score) || 60;
    const allowedObtain = lines(s.allowed_obtain);
    const batchSize = Math.min(20, Math.max(1, Number(s.ai_batch_size) || 12));
    const aiItems = list.filter((it) => it.attempts < 3);
    for (const it of list.filter((x) => x.attempts >= 3)) applyVerdict(it, heuristicJudge(it, s));
    const batches = [];
    for (let i = 0; i < aiItems.length; i += batchSize) batches.push(aiItems.slice(i, i + batchSize));
    await Promise.all(batches.map(async (batch) => {
      try {
        const verdicts = await judgeBatch(batch, s);
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
          const ok = v.relevant === true && signupOk && category !== 'other' && score >= minScore && allowedObtain.includes(obtain);
          applyVerdict(it, {
            status: ok ? 'approved' : 'rejected',
            category,
            name: v.name ? String(v.name).slice(0, 100) : null,
            summary: v.summary ? String(v.summary).slice(0, 300) : null,
            signup: v.signup ? String(v.signup).slice(0, 100) : null,
            score,
            obtain,
            judged_by: `ai:${s.ai_model}`,
          });
        });
      } catch (e) {
        stats.errors++;
        log.push(`✗ AI 判定失败：${e.message}`);
        for (const it of batch) updates.push(env.DB.prepare('UPDATE items SET attempts = attempts + 1 WHERE id=?').bind(it.id));
      }
    }));
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
    env.DB.prepare('DELETE FROM jobs WHERE run_id IN (SELECT id FROM runs WHERE started_at < ?)').bind(c.now - 2 * DAY),
    env.DB.prepare('DELETE FROM runs WHERE started_at < ?').bind(c.now - keepMs),
  ]);
}

const STEP_LABEL = { source: '抓取', search: '搜索', judge: '判定', cleanup: '清理', mail: '推送' };

/** 新建一次运行（已有进行中的运行则直接返回它） */
export async function planRun(env, trigger = 'cron', opts = {}) {
  const now = Date.now();
  const active = await env.DB.prepare('SELECT id, started_at FROM runs WHERE finished_at IS NULL ORDER BY id DESC LIMIT 1').first();
  if (active && now - active.started_at < 3 * 3600000) return { run_id: active.id, existing: true };
  if (active) await env.DB.prepare("UPDATE runs SET finished_at = ?, log = log || ? WHERE id = ?").bind(now, '\n✗ 超时未完成，已放弃', active.id).run();

  const s = await getSettings(env);
  const log = [];
  const aiReady = aiReadyOf(s);
  const sources = listSources(s, aiReady, log);
  const steps = opts.only === 'judge' ? [] : sources.map((src) => ['source', { src }]);
  if (opts.only === 'judge') {
    steps.push(['judge', { cap: opts.cap || 0 }]); // 只重新判定，不抓取
  } else {
    // 可用的搜索后端并行跑；单次调用外部请求上限 50，按每步最多 40 个请求分组
    const ready = BACKENDS.filter((b) => backendReady(s, b)).map((b) => b.id);
    const perBackend = Math.max(1, Number(s.search_max_queries) || 8);
    const group = Math.max(1, Math.min(2, Math.floor(40 / perBackend))); // 每步最多 2 家并行，控制单步 CPU
    for (let i = 0; i < ready.length; i += group) steps.push(['search', { engines: ready.slice(i, i + group) }]);
    steps.push(['judge', {}], ['cleanup', {}]);
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
      try {
        const items = await fetchSource(src, c.cutoff, env);
        log.push(`✓ ${src.name}: ${items.length} 条`);
        await ingest(env, c, src, items, stats, log);
      } catch (e) { stats.errors++; log.push(`✗ ${src.name}: ${e.message}`); }
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
    case 'judge':
      return judgeStep(env, c, stats, log, runStats.judged || 0, p.cap);
    case 'cleanup':
      await cleanupStep(env, c, stats);
      return false;
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
    await env.DB.prepare("UPDATE jobs SET status = 'pending' WHERE run_id = ? AND status = 'running' AND claimed_at < ?").bind(run.id, t - 5 * 60000).run();
    const job = await env.DB.prepare(
      `UPDATE jobs SET status = 'running', claimed_at = ?1
       WHERE id = (SELECT id FROM jobs WHERE run_id = ?2 AND status = 'pending' ORDER BY seq LIMIT 1)
         AND NOT EXISTS (SELECT 1 FROM jobs WHERE run_id = ?2 AND status = 'running')
       RETURNING *`
    ).bind(t, run.id).first();
    if (!job) { busy = !!(await env.DB.prepare("SELECT 1 AS x FROM jobs WHERE run_id = ? AND status = 'running' LIMIT 1").bind(run.id).first()); break; }
    const pl = JSON.parse(job.payload || '{}');
    current = STEP_LABEL[job.kind] + (job.kind === 'source' ? '：' + (pl.src?.name || '') : job.kind === 'search' ? '：' + (pl.engines || [pl.engine]).map((id) => BACKEND_MAP[id]?.name || id).join(' + ') : '');
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
