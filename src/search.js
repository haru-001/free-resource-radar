// 联网搜索后端（结果交给统一的过滤 + AI 判定流程）
// 各家接口的请求格式、免费额度参考 bestnite/search 的 BACKENDS.md（MIT License，核实日期 2026-11-17），
// 只移植能在 Workers 里直接用 HTTP 调用的几家，并按中文场景挑选。
import { lines } from './db.js';
import { enabledCats, searchQueriesFor } from './categories.js';

const CJK = /[\u4e00-\u9fff]/;

/** 某个搜索后端负责的分类：后台给它勾选的分类 ∩ 全局已勾选分类；没单独设置就是全部已勾选分类 */
export function backendCats(s, id) {
  const all = enabledCats(s);
  const own = String(s[`${id}_cats`] || '').split(',').map((x) => x.trim()).filter(Boolean);
  return own.length ? all.filter((k) => own.includes(k)) : all;
}

export function searchQueries(s, cats) {
  let qs = String(s.search_queries || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (!qs.length) qs = searchQueriesFor(cats || enabledCats(s)); // 留空：按（该后端负责的）分类自动生成
  const lang = s.search_lang || 'zh_first';
  // 只要中文时去掉纯英文查询
  if (lang === 'zh_only') qs = qs.filter((q) => CJK.test(q));
  return qs.slice(0, Math.max(1, Number(s.search_max_queries) || 12));
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

// 分批并发跑多个查询（避免触发限流，如 Keenable 公共接口 10 RPS），429 自动重试一次；全部失败才抛错
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function runQueries(queries, fn, name, concurrency = 4) {
  const settled = [];
  const once = async (q) => {
    try { return await fn(q); } catch (e) {
      if (/HTTP 429/.test(e.message)) { await sleep(1500); return fn(q); }
      throw e;
    }
  };
  for (let i = 0; i < queries.length; i += concurrency) {
    if (i) await sleep(1100);
    settled.push(...(await Promise.allSettled(queries.slice(i, i + concurrency).map(once))));
  }
  const ok = settled.filter((x) => x.status === 'fulfilled');
  if (!ok.length && settled.length) throw settled[0].reason || new Error(`${name} 全部查询失败`);
  const errors = settled.filter((x) => x.status === 'rejected').map((x) => x.reason?.message);
  return { items: ok.flatMap((x) => x.value), errors };
}


const sinceDate = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
const pick = (r) => ({ title: r.title || r.url, url: r.url, published_at: r.published_at || null, raw_text: String(r.raw_text || '').slice(0, 1500) });
const parseTime = (v) => { if (!v) return null; const t = Date.parse(v); return Number.isFinite(t) ? t : null; };

/**
 * 搜索后端注册表。设置项统一为 `${id}_enabled`、`${id}_api_key`。
 * keyless：不填 Key 也能用（公共接口按 IP 限额）；填了 Key 就固定走 Key，不会自动降级。
 */
export const BACKENDS = [
  {
    id: 'anysearch', name: 'AnySearch', keyless: true, zh: true,
    free: '免 Key 每天 1000 次（按 IP）；注册后每天 1000 次',
    signup: 'https://www.anysearch.com', note: '中文结果好（zone=cn），推荐',
    async search(s, query, days) {
      const headers = s.anysearch_api_key ? { Authorization: `Bearer ${s.anysearch_api_key}` } : {};
      const j = await postJson('https://api.anysearch.com/v1/search', headers, { query, max_results: Math.min(10, Number(s.search_max_results) || 10), zone: 'cn' }, 'AnySearch');
      if (j.code && j.code !== 0) throw new Error(`AnySearch ${j.code}: ${String(j.message || '').slice(0, 100)}`);
      return (j.data?.results || []).map((r) => pick({ title: r.title, url: r.url, raw_text: r.snippet || r.content }));
    },
  },
  {
    id: 'keenable', name: 'Keenable', keyless: true,
    free: '免 Key 每小时 1000 次（按 IP）；注册后每月 10 万次',
    signup: 'https://keenable.ai', note: '支持按发布时间过滤',
    async search(s, query, days) {
      const key = s.keenable_api_key;
      const url = key ? 'https://api.keenable.ai/v1/search' : 'https://api.keenable.ai/v1/search/public';
      const headers = key ? { 'X-API-Key': key } : { 'X-Keenable-Title': 'Free Resource Radar' };
      const body = { query, mode: s.keenable_mode || 'pro', max_results: Math.min(50, Number(s.search_max_results) || 10), published_after: `${days}d`, snippet_max_length: 800, disable_cards: true };
      const ex = blockList(s); if (ex.length) body.exclude_domains = ex;
      const j = await postJson(url, headers, body, 'Keenable');
      return (j.results || []).map((r) => pick({ title: r.title, url: r.url, published_at: parseTime(r.published_at), raw_text: r.snippet }));
    },
  },
  {
    id: 'tavily', name: 'Tavily', keyless: false,
    free: '每月 1000 credits，不用绑卡',
    signup: 'https://app.tavily.com', note: '中文查询自动 language=zh-cn',
    async search(s, query, days) {
      const body = { query, search_depth: s.tavily_depth || 'basic', max_results: Math.min(20, Number(s.search_max_results) || 10), topic: 'general', auto_parameters: false, start_date: sinceDate(days), filter_by_published_date: true, include_published_date: true, include_answer: false, include_raw_content: false };
      const ex = blockList(s).slice(0, 150); if (ex.length) body.exclude_domains = ex;
      if (CJK.test(query) && (s.search_lang || 'zh_only') !== 'any') { body.language = 'zh-cn'; if ((s.search_lang || 'zh_only') === 'zh_only') body.filter_by_language = true; }
      const j = await postJson('https://api.tavily.com/search', { Authorization: `Bearer ${s.tavily_api_key}` }, body, 'Tavily');
      return (j.results || []).map((r) => pick({ title: r.title, url: r.url, published_at: parseTime(r.published_date), raw_text: r.content }));
    },
  },
  {
    id: 'exa', name: 'Exa', keyless: false,
    free: '注册送 $10，每月 1 日重置为 $10（约 1400 次 lite 搜索）',
    signup: 'https://dashboard.exa.ai', note: '',
    async search(s, query, days) {
      const body = { query, type: 'lite', numResults: Math.min(10, Number(s.search_max_results) || 10), startPublishedDate: new Date(Date.now() - days * 86400000).toISOString(), contents: { highlights: true } };
      const j = await postJson('https://api.exa.ai/search', { 'x-api-key': s.exa_api_key }, body, 'Exa');
      return (j.results || []).map((r) => pick({ title: r.title, url: r.url, published_at: parseTime(r.publishedDate), raw_text: (r.highlights || []).join(' ') || r.text }));
    },
  },
  {
    id: 'brave', name: 'Brave Search', keyless: false,
    free: '每月自动赠送 $5 额度（约 1000 次）',
    signup: 'https://api-dashboard.search.brave.com', note: '',
    async search(s, query, days) {
      const fresh = days <= 1 ? 'pd' : days <= 7 ? 'pw' : days <= 31 ? 'pm' : 'py';
      const qs = new URLSearchParams({ q: query, count: String(Math.min(20, Number(s.search_max_results) || 10)), freshness: fresh });
      if (CJK.test(query)) qs.set('search_lang', 'zh-hans');
      const r = await fetch(`https://api.search.brave.com/res/v1/web/search?${qs}`, { headers: { 'X-Subscription-Token': s.brave_api_key, Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      const text = await r.text();
      if (!r.ok) throw new Error(`Brave HTTP ${r.status}: ${text.slice(0, 200)}`);
      const j = JSON.parse(text);
      return (j.web?.results || []).map((x) => pick({ title: x.title, url: x.url, raw_text: [x.description, ...(x.extra_snippets || [])].join(' ').replace(/<[^>]+>/g, '') }));
    },
  },
  {
    id: 'qianfan', name: '百度千帆搜索', keyless: false, zh: true,
    free: '每月 1500 次（约每天 50 次），需实名开通',
    signup: 'https://cloud.baidu.cn/doc/qianfan/s/nmweljpt3', note: '百度中文结果',
    async search(s, query, days) {
      const recency = days <= 7 ? 'week' : days <= 31 ? 'month' : days <= 183 ? 'semiyear' : 'year';
      const body = { messages: [{ role: 'user', content: query }], search_source: 'baidu_search_v2', edition: 'standard', resource_type_filter: [{ type: 'web', top_k: Math.min(20, Number(s.search_max_results) || 10) }], search_recency_filter: recency };
      const j = await postJson('https://qianfan.baidubce.com/v2/ai_search/web_search', { Authorization: `Bearer ${s.qianfan_api_key}` }, body, '百度千帆');
      if (j.code && !j.references) throw new Error(`百度千帆 ${j.code}: ${String(j.message || '').slice(0, 100)}`);
      return (j.references || []).map((r) => pick({ title: r.title, url: r.url, published_at: parseTime(r.date), raw_text: r.snippet || r.content }));
    },
  },
  {
    id: 'volc', name: '火山引擎联网搜索', keyless: false, zh: true,
    free: '每月 500 次，需开通服务',
    signup: 'https://docs.volcengine.com/docs/networked-search/networked-search?lang=zh', note: '抖音 / 头条系中文结果',
    async search(s, query, days) {
      const range = days <= 1 ? 'OneDay' : days <= 7 ? 'OneWeek' : days <= 31 ? 'OneMonth' : 'OneYear';
      const body = { Query: query.slice(0, 100), SearchType: 'web', Count: Math.min(50, Number(s.search_max_results) || 10), TimeRange: range, Filter: { NeedUrl: true }, QueryControl: { QueryRewrite: false } };
      const j = await postJson('https://open.feedcoopapi.com/search_api/web_search', { Authorization: `Bearer ${s.volc_api_key}` }, body, '火山引擎');
      const err = j.ResponseMetadata?.Error;
      if (err) throw new Error(`火山引擎 ${err.Code || ''}: ${String(err.Message || '').slice(0, 100)}`);
      return (j.Result?.WebResults || []).map((r) => pick({ title: r.Title, url: r.Url, published_at: parseTime(r.PublishTime), raw_text: r.Summary || r.Snippet }));
    },
  },
];
export const BACKEND_MAP = Object.fromEntries(BACKENDS.map((b) => [b.id, b]));

/** 后端是否可用：开关打开，且免 Key 的或已填 Key */
export const backendReady = (s, b) => s[`${b.id}_enabled`] === 'true' && (b.keyless || !!s[`${b.id}_api_key`]);

/** 用某个后端跑完所有搜索词 */
export async function runBackend(s, id, maxAgeDays) {
  const b = BACKEND_MAP[id];
  if (!b) throw new Error(`未知搜索后端：${id}`);
  if (!b.keyless && !s[`${id}_api_key`]) throw new Error(`未填写 ${b.name} 的 API Key`);
  const cats = backendCats(s, id);
  if (!cats.length) return { items: [], errors: [], skipped: '负责的分类都没有勾选' };
  const r = await runQueries(searchQueries(s, cats), (q) => b.search(s, q, maxAgeDays), b.name);
  for (const it of r.items) it.source = `${b.name} 搜索`;
  return r;
}

/** 给「发现新源」用：用最多 2 个可用后端搜这些词，返回去重后的结果 */
export async function searchForDiscovery(s, queries) {
  const ready = BACKENDS.filter((b) => backendReady(s, b)).slice(0, 2);
  if (!ready.length) return { results: [], errors: ['没有可用的搜索后端，去「AI 与搜索」打开一个'] };
  const results = [], errors = [];
  const jobs = ready.flatMap((b) => queries.map((q) => b.search(s, q, 3650).then((l) => results.push(...l), (e) => errors.push(`${b.name}：${e.message}`))));
  await Promise.all(jobs);
  return { results, errors };
}
