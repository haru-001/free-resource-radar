// 抓取、过滤、AI 判定的主流程
import { getSettings, lines } from './db.js';
import { judgeBatch, searchWithModel } from './ai.js';
import { dayOf } from './db.js';
import { searchTavily, searchKeenable } from './search.js';
import { isNoiseTitle, guessObtain, compileBlockRules, matchBlock, titleFingerprint } from './rules.js';

const UA = 'Mozilla/5.0 (compatible; FreeResourceRadar/1.0; +https://workers.cloudflare.com)';
const DAY = 86400000;

async function getText(url, headers = {}) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: '*/*', ...headers },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
const getJson = async (url, headers) => JSON.parse(await getText(url, { Accept: 'application/json', ...headers }));

// ---------- 文本工具 ----------
export function decodeEntities(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
export function cleanText(s) {
  let t = String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  t = decodeEntities(t); // 有些源把 HTML 转义后放进 description
  t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
  return decodeEntities(t).replace(/\s+/g, ' ').trim();
}
function tag(block, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i');
  const m = block.match(re);
  return m ? m[1] : '';
}
export function parseDate(s) {
  if (!s) return null;
  const t = Date.parse(String(s).replace(/<!\[CDATA\[|\]\]>/g, '').trim());
  return Number.isFinite(t) ? t : null;
}
export function parseFeed(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map((b) => {
    let link = cleanText(tag(b, 'link'));
    if (!link) {
      const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || b.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = alt ? decodeEntities(alt[1]) : cleanText(tag(b, 'guid'));
    }
    return {
      title: cleanText(tag(b, 'title')),
      url: link,
      published_at: parseDate(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'dc:date') || tag(b, 'updated')),
      raw_text: cleanText(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content:encoded') || tag(b, 'content')).slice(0, 1500),
    };
  });
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
    case 'rss':
    default:
      if (!src.url) throw new Error('缺少 url');
      return parseFeed(await getText(src.url, { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' }));
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

function heuristicJudge(item, s) {
  const text = `${item.title} ${item.raw_text || ''}`.toLowerCase();
  const hard = lines(s.hard_signup_keywords).find((w) => text.includes(w));
  const isDomain = /域名|domain|subdomain/.test(text);
  const obtain = guessObtain(item.title, item.raw_text || '');
  const allowed = lines(s.allowed_obtain);
  return {
    status: hard || !allowed.includes(obtain) ? 'rejected' : 'approved',
    obtain,
    category: isDomain ? 'domain' : 'hosting',
    name: null,
    summary: (item.raw_text || '').slice(0, 120),
    signup: hard ? `疑似需要：${hard}` : allowed.includes(obtain) ? '未经 AI 判定' : `获取方式：${obtain}`,
    score: null,
    judged_by: 'keywords',
  };
}

// ---------- 主流程 ----------
export async function runCrawl(env, trigger = 'cron') {
  const startedAt = Date.now();
  const s = await getSettings(env);
  const maxAgeDays = Math.max(1, Number(s.max_age_days) || 180);
  const cutoff = startedAt - maxAgeDays * DAY;
  const keepUndated = s.keep_undated === 'true';
  const topicWords = lines(s.topic_keywords);
  const freeWords = lines(s.free_keywords);
  const hardWords = lines(s.hard_signup_keywords);
  const blockDomains = lines(s.search_block_domains);
  const searchLang = s.search_lang || 'zh_first';
  const blockRules = compileBlockRules(s.block_rules);
  const noiseOn = s.noise_filter !== 'false';
  const log = [];
  const stats = { fetched: 0, blocked: 0, block_rule: 0, noise: 0, dup_title: 0, non_zh: 0, hard_signup: 0, too_old: 0, undated: 0, off_topic: 0, candidates: 0, new: 0, judged: 0, approved: 0, rejected: 0, expired_removed: 0, errors: 0 };

  let sources = [];
  try { sources = JSON.parse(s.sources).filter((x) => x && x.enabled !== false); } catch (e) { log.push(`数据源 JSON 解析失败：${e.message}`); }

  // 1. 抓取
  const tasks = sources.map((src) =>
    fetchSource(src, cutoff, env).then(
      (items) => ({ src, items: items.map((it) => ({ ...it, source: src.name || src.type })) }),
      (err) => ({ src, error: err })
    )
  );
  const aiReady = s.ai_enabled === 'true' && s.ai_api_key && s.ai_base_url && s.ai_model;
  const searchReady = s.search_enabled === 'true' && s.search_api_key && s.search_base_url && s.search_model;
  if (searchReady) {
    tasks.push(
      searchWithModel(s, maxAgeDays).then(
        (items) => ({ src: { name: 'AI 联网搜索', isSearch: true }, items }),
        (err) => ({ src: { name: 'AI 联网搜索' }, error: err })
      )
    );
  }
  const apiSearch = (name, fn) =>
    tasks.push(fn(s, maxAgeDays).then(
      ({ items, errors }) => { for (const e of errors) log.push(`! ${name} 部分查询失败：${e}`); return { src: { name, isSearch: true }, items }; },
      (err) => ({ src: { name }, error: err })
    ));
  if (s.tavily_enabled === 'true') apiSearch('Tavily 搜索', searchTavily);
  if (s.keenable_enabled === 'true') apiSearch('Keenable 搜索', searchKeenable);
  const results = await Promise.all(tasks);

  // 2. 时间 + 关键词过滤
  const candidates = new Map();
  const seenFp = new Set();
  for (const r of results) {
    if (r.error) { stats.errors++; log.push(`✗ ${r.src.name}: ${r.error.message}`); continue; }
    log.push(`✓ ${r.src.name}: ${r.items.length} 条`);
    for (const it of r.items) {
      stats.fetched++;
      if (!it.url || !it.title) continue;
      if (!it.published_at) { if (!keepUndated) { stats.undated++; continue; } }
      else if (it.published_at < cutoff) { stats.too_old++; continue; }
      if (isBlocked(it.url, blockDomains)) { stats.blocked++; continue; }
      if (noiseOn && isNoiseTitle(it.title)) { stats.noise++; continue; }
      if (blockRules.length && matchBlock(blockRules, `${it.title}\n${it.raw_text || ''}`)) { stats.block_rule++; continue; }
      if (r.src.isSearch) {
        // 联网搜索结果额外过滤：语言 + 明显的复杂注册
        const zh = it.lang ? it.lang.startsWith('zh') : CJK.test(it.title);
        if (searchLang === 'zh_only' && !zh) { stats.non_zh++; continue; }
        const t = `${it.title} ${it.raw_text || ''}`.toLowerCase();
        if (hardWords.some((w) => t.includes(w) && !t.includes('无需' + w) && !t.includes('不需要' + w) && !t.includes('no ' + w))) { stats.hard_signup++; continue; }
      }
      if (r.src.filter !== false) {
        const text = `${it.title} ${it.raw_text || ''}`.toLowerCase();
        if (!containsAny(text, topicWords) || !containsAny(text, freeWords)) { stats.off_topic++; continue; }
      }
      const url = normalizeUrl(it.url);
      const id = await hashId(url);
      const fp = titleFingerprint(it.title);
      if (candidates.has(id)) continue;
      if (fp.length >= 8 && seenFp.has(fp)) { stats.dup_title++; continue; }
      if (fp.length >= 8) seenFp.add(fp);
      candidates.set(id, { ...it, url, id, fp });
    }
  }
  stats.candidates = candidates.size;

  // 3. 去重入库（新条目为 pending）
  const ids = [...candidates.keys()];
  const existing = new Set();
  const existingFp = new Set();
  const today = dayOf(startedAt);
  for (let i = 0; i < ids.length; i += 45) {
    const chunk = ids.slice(i, i + 45);
    const fps = chunk.map((id) => candidates.get(id).fp || '-');
    const { results: rows } = await env.DB.prepare(
      `SELECT id, fp FROM seen WHERE id IN (${chunk.map(() => '?').join(',')}) OR fp IN (${fps.map(() => '?').join(',')})`
    ).bind(...chunk, ...fps).all();
    for (const row of rows || []) { existing.add(row.id); if (row.fp) existingFp.add(row.fp); }
  }
  const inserts = [];
  for (const [id, it] of candidates) {
    if (existing.has(id)) continue;
    if (it.fp && it.fp.length >= 8 && existingFp.has(it.fp)) { stats.dup_title++; continue; }
    inserts.push(
      env.DB.prepare('INSERT OR IGNORE INTO items (id, title, url, source, raw_text, published_at, fetched_at, status, fp, day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, it.title.slice(0, 500), it.url, it.source || '', (it.raw_text || '').slice(0, 2000), it.published_at || null, startedAt, 'pending', it.fp || null, today),
      env.DB.prepare('INSERT OR IGNORE INTO seen (id, fp, seen_at) VALUES (?, ?, ?)').bind(id, it.fp || null, startedAt)
    );
  }
  for (let i = 0; i < inserts.length; i += 50) await env.DB.batch(inserts.slice(i, i + 50));
  stats.new = inserts.length / 2; // 每条两句：items + seen

  // 4. 判定待处理条目（AI 优先，失败 3 次后回退到关键词）
  const maxItems = Math.max(1, Number(s.ai_max_items) || 40);
  const { results: pending } = await env.DB.prepare(
    'SELECT * FROM items WHERE status = ? AND (published_at IS NULL OR published_at >= ?) ORDER BY published_at DESC LIMIT ?'
  ).bind('pending', cutoff, maxItems).all();

  const updates = [];
  const applyVerdict = (it, v) => {
    updates.push(
      env.DB.prepare('UPDATE items SET status=?, category=?, name=?, summary=?, signup=?, score=?, obtain=?, judged_by=?, judged_at=? WHERE id=?')
        .bind(v.status, v.category, v.name, v.summary, v.signup, v.score, v.obtain || null, v.judged_by, Date.now(), it.id)
    );
    stats.judged++;
    if (v.status === 'approved') stats.approved++; else stats.rejected++;
  };

  if (aiReady) {
    const minScore = Number(s.ai_min_score) || 60;
    const allowedObtain = lines(s.allowed_obtain);
    const batchSize = Math.min(20, Math.max(1, Number(s.ai_batch_size) || 8));
    const aiItems = (pending || []).filter((it) => it.attempts < 3);
    for (const it of (pending || []).filter((x) => x.attempts >= 3)) applyVerdict(it, heuristicJudge(it, s));
    const batches = [];
    for (let i = 0; i < aiItems.length; i += batchSize) batches.push(aiItems.slice(i, i + batchSize));
    // 小并发，避免触发限流
    for (let i = 0; i < batches.length; i += 3) {
      await Promise.all(batches.slice(i, i + 3).map(async (batch) => {
        try {
          const verdicts = await judgeBatch(batch, s);
          batch.forEach((it, idx) => {
            const v = verdicts.get(idx);
            if (!v) { updates.push(env.DB.prepare('UPDATE items SET attempts = attempts + 1 WHERE id=?').bind(it.id)); return; }
            const score = Math.round(Number(v.score) || 0);
            const obtain = ['free', 'conditional', 'lottery', 'trial', 'promo', 'paid'].includes(v.obtain) ? v.obtain : guessObtain(it.title, it.raw_text || '');
            const ok = v.relevant === true && v.simple_signup === true && score >= minScore && allowedObtain.includes(obtain);
            applyVerdict(it, {
              status: ok ? 'approved' : 'rejected',
              category: ['domain', 'hosting'].includes(v.category) ? v.category : 'other',
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
    }
  } else {
    if (s.ai_enabled === 'true') log.push('AI 已启用但配置不完整，使用关键词判定');
    for (const it of pending || []) applyVerdict(it, heuristicJudge(it, s));
  }
  for (let i = 0; i < updates.length; i += 50) await env.DB.batch(updates.slice(i, i + 50));

  // 5. 定期清理：条目按抓取日期保留 retention_days 天（默认 15），超过半年的也删；去重记忆保留到半年
  const keepMs = Math.max(1, Number(s.retention_days) || 15) * 86400000;
  const del = await env.DB.prepare('DELETE FROM items WHERE fetched_at < ? OR (published_at IS NOT NULL AND published_at < ?)').bind(startedAt - keepMs, cutoff).run();
  stats.expired_removed = del.meta?.changes || 0;
  await env.DB.prepare('DELETE FROM seen WHERE seen_at < ?').bind(Math.min(cutoff, startedAt - keepMs)).run();
  await env.DB.prepare('DELETE FROM runs WHERE started_at < ?').bind(startedAt - keepMs).run();

  const finishedAt = Date.now();
  log.push(`耗时 ${((finishedAt - startedAt) / 1000).toFixed(1)}s`);
  await env.DB.prepare('INSERT INTO runs (trigger, started_at, finished_at, stats, log) VALUES (?, ?, ?, ?, ?)')
    .bind(trigger, startedAt, finishedAt, JSON.stringify(stats), log.join('\n')).run();
  await env.DB.prepare('DELETE FROM runs WHERE id NOT IN (SELECT id FROM runs ORDER BY id DESC LIMIT 60)').run();
  return { stats, log };
}
