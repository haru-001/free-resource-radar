// 搜索 API：Tavily / Keenable（结果交给统一的过滤 + AI 判定流程）
import { lines } from './db.js';

const CJK = /[\u4e00-\u9fff]/;

export function searchQueries(s) {
  const qs = String(s.search_queries || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const lang = s.search_lang || 'zh_first';
  // 只要中文时去掉纯英文查询
  return lang === 'zh_only' ? qs.filter((q) => CJK.test(q)) : qs;
}

function blockList(s) {
  return lines(s.search_block_domains).map((d) => d.replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter((d) => d.includes('.'));
}

async function postJson(url, headers, body, name) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${name} HTTP ${r.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

// 并发跑多个查询，单个失败不影响其他；全部失败才抛错
async function runQueries(queries, fn, name) {
  const settled = await Promise.allSettled(queries.map(fn));
  const ok = settled.filter((x) => x.status === 'fulfilled');
  if (!ok.length && settled.length) throw settled[0].reason || new Error(`${name} 全部查询失败`);
  const errors = settled.filter((x) => x.status === 'rejected').map((x) => x.reason?.message);
  return { items: ok.flatMap((x) => x.value), errors };
}

export async function searchTavily(s, maxAgeDays) {
  if (!s.tavily_api_key) throw new Error('未填写 Tavily API Key');
  const lang = s.search_lang || 'zh_first';
  const start = new Date(Date.now() - maxAgeDays * 86400000).toISOString().slice(0, 10);
  const exclude = blockList(s).slice(0, 150);
  return runQueries(searchQueries(s), async (query) => {
    const zhQuery = CJK.test(query);
    const body = {
      query,
      search_depth: s.tavily_depth || 'basic',
      max_results: Math.min(20, Number(s.search_max_results) || 10),
      topic: 'general',
      start_date: start,
      filter_by_published_date: true,   // 去掉无日期和超期的
      include_published_date: true,
      include_answer: false,
      include_raw_content: false,
    };
    if (exclude.length) body.exclude_domains = exclude;
    if (zhQuery && lang !== 'any') {
      body.language = 'zh-cn';
      if (lang === 'zh_only') body.filter_by_language = true;
    }
    const j = await postJson('https://api.tavily.com/search', { Authorization: `Bearer ${s.tavily_api_key}` }, body, 'Tavily');
    return (j.results || []).map((r) => ({
      title: r.title || r.url,
      url: r.url,
      published_at: r.published_date ? Date.parse(r.published_date) || null : null,
      raw_text: String(r.content || '').slice(0, 1500),
      source: 'Tavily 搜索',
    }));
  }, 'Tavily');
}

export async function searchKeenable(s, maxAgeDays) {
  const key = s.keenable_api_key;
  const url = key ? 'https://api.keenable.ai/v1/search' : 'https://api.keenable.ai/v1/search/public';
  const headers = key ? { 'X-API-Key': key } : { 'X-Keenable-Title': 'Free Resource Radar' };
  const exclude = blockList(s);
  return runQueries(searchQueries(s), async (query) => {
    const body = {
      query,
      mode: s.keenable_mode || 'pro',
      max_results: Math.min(50, Number(s.search_max_results) || 10),
      published_after: `${maxAgeDays}d`, // 会自动去掉无发布日期的页面
      snippet_max_length: 800,
      disable_cards: true,
    };
    if (exclude.length) body.exclude_domains = exclude;
    const j = await postJson(url, headers, body, 'Keenable');
    return (j.results || []).map((r) => ({
      title: r.title || r.url,
      url: r.url,
      published_at: r.published_at ? Date.parse(r.published_at) || null : null,
      raw_text: String(r.snippet || '').slice(0, 1500),
      source: 'Keenable 搜索',
    }));
  }, 'Keenable');
}
