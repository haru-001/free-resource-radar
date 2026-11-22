// v1.8 板块：周报精选、学生 / 开发者专区、签到清单
import { isInfoCat } from './categories.js';

const DAY = 86400000;

/** 综合分：AI 分 + 投票 + 被几个来源提到 + 是否直接白嫖；疑似失效的沉底 */
export function rankOf(it) {
  const srcN = Array.isArray(it.srcs) ? it.srcs.length : 0;
  return (it.score ?? 70) + (it.up || 0) * 6 - (it.down || 0) * 8 + srcN * 4 + (it.obtain === 'free' ? 5 : 0) + (it.expires_at ? 3 : 0) - (it.dead ? 60 : 0);
}

/** 本周精选：近 7 天的福利类条目里综合分最高的 10 条，每个分类最多 3 条 */
export function weeklyPicks(items, now = Date.now(), n = 10) {
  const list = items.filter((it) => !isInfoCat(it.category) && !it.dead && !(it.extra && it.extra.subs) && now - (it.published_at || it.fetched_at || 0) <= 7 * DAY && !(it.expires_at && it.expires_at < now));
  list.sort((a, b) => rankOf(b) - rankOf(a));
  const per = {}, out = [], seen = new Set();
  for (const it of list) {
    // 同一个东西被不同来源以不同标题收录（如 Epic 和 GamerPower 都报了同一款游戏）只留一条
    const k = String(it.name || it.title).toLowerCase().replace(/[（(【[][^)）】\]]*[)）】\]]/g, '').replace(/giveaway|免费领取|限免|epic|steam|[^\p{L}\p{N}]+/gu, '').slice(0, 24);
    if (k && seen.has(k)) continue;
    if (k) seen.add(k);
    if ((per[it.category] = (per[it.category] || 0) + 1) > 3) continue;
    out.push(it);
    if (out.length >= n) break;
  }
  return out;
}

// 学生 / 开发者长期权益（2026-11 核对过地址）。后台「perks_extra」可追加，每行：名称 | 地址 | 说明 | 学生 或 开发者
export const PERKS = [
  { name: 'GitHub 学生开发者包', url: 'https://education.github.com/pack', note: '学生认证后送 Copilot Pro、域名、云服务额度等几十项权益', who: '学生' },
  { name: 'JetBrains 教育许可', url: 'https://www.jetbrains.com/academy/student-pack/', note: '学生和老师免费用 IntelliJ IDEA、PyCharm 等全家桶', who: '学生' },
  { name: 'Azure 学生版', url: 'https://azure.microsoft.com/free/students/', note: '学校邮箱认证，送 100 美元额度，不用信用卡', who: '学生' },
  { name: 'Figma 教育版', url: 'https://www.figma.com/education/', note: '学生和老师免费用专业版', who: '学生' },
  { name: 'Notion 教育版', url: 'https://www.notion.com/product/notion-for-education', note: '学校邮箱注册，个人 Plus 免费', who: '学生' },
  { name: 'Autodesk 教育版', url: 'https://www.autodesk.com/education/home', note: 'AutoCAD、Maya、Fusion 等教育许可', who: '学生' },
  { name: 'Canva 教育版', url: 'https://www.canva.com/education/', note: '老师和学生免费用高级功能', who: '学生' },
  { name: 'Cloudflare 免费计划', url: 'https://www.cloudflare.com/plans/free/', note: 'CDN、DNS、Workers、Pages、R2 都有长期免费额度', who: '开发者' },
  { name: 'Oracle Cloud 永久免费', url: 'https://www.oracle.com/cloud/free/', note: '永久免费的 ARM 云主机和数据库（注册要绑卡验证）', who: '开发者' },
  { name: 'Google Cloud 免费层', url: 'https://cloud.google.com/free', note: '新用户 300 美元额度 + 长期免费的小规格资源', who: '开发者' },
  { name: 'AWS 免费套餐', url: 'https://aws.amazon.com/free/', note: '新用户额度 + 一批长期免费的服务', who: '开发者' },
  { name: 'Vercel Hobby', url: 'https://vercel.com/pricing', note: '个人项目免费托管前端和 Serverless 函数', who: '开发者' },
  { name: 'Netlify 免费版', url: 'https://www.netlify.com/pricing/', note: '静态站点和函数免费托管', who: '开发者' },
  { name: 'Supabase 免费版', url: 'https://supabase.com/pricing', note: '免费的 Postgres 数据库、认证和存储', who: '开发者' },
  { name: 'EU.org 免费域名', url: 'https://nic.eu.org/', note: '老牌免费二级域名，人工审核，可接 Cloudflare', who: '开发者' },
  { name: 'free-for-dev 清单', url: 'https://free-for.dev/', note: '开发者免费服务大全（英文），持续更新', who: '开发者' },
];

/** 「名称 | 地址 | 说明 | 分组」一行一条 */
export function parseRows(text, keys) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    const parts = l.split(/\s*[|｜]\s*/);
    const url = parts.find((x) => /^https?:\/\//.test(x));
    if (!url) continue;
    const rest = parts.filter((x) => x !== url);
    const o = { url };
    keys.forEach((k, i) => { if (rest[i]) o[k] = rest[i]; });
    if (!o.name) { try { o.name = new URL(url).hostname.replace(/^www\./, ''); } catch { o.name = url; } }
    out.push(o);
    if (out.length >= 60) break;
  }
  return out;
}
export const perksOf = (s) => (s.perks_enabled === 'false' ? [] : [...PERKS, ...parseRows(s.perks_extra, ['name', 'note', 'who']).map((x) => ({ ...x, who: /学生|edu|student/i.test(x.who || '') ? '学生' : '开发者' }))]);
export const checkinOf = (s) => parseRows(s.checkin_sites, ['name', 'note']);

// ---------- AI 福利雷达：按厂商和福利关键词搜索，再整理成「厂商 · 福利类型 · 怎么领 · 截止」 ----------
// 厂商识别：标题 / 正文里出现就记下（显示名, 正则）
const VENDORS = [
  ['OpenAI', /openai|chatgpt|gpt-?\d|codex|sora/i], ['Anthropic', /anthropic|claude/i], ['Google', /google|gemini|antigravity|vertex|ai studio|jules/i],
  ['DeepSeek', /deepseek|深度求索/i], ['阿里', /qwen|通义|阿里云百炼|百炼|modelscope|魔搭/i], ['月之暗面', /kimi|moonshot|月之暗面/i], ['智谱', /智谱|glm-?\d|chatglm|bigmodel/i],
  ['MiniMax', /minimax|海螺/i], ['字节', /豆包|doubao|火山方舟|火山引擎|trae|coze|扣子/i], ['腾讯', /混元|hunyuan|腾讯云|codebuddy|元宝/i], ['百度', /文心|ernie|千帆/i],
  ['xAI', /xai|grok/i], ['Mistral', /mistral/i], ['Meta', /llama|meta ai/i], ['Microsoft', /microsoft|azure|copilot|bing/i], ['Amazon', /aws|amazon|bedrock|kiro/i],
  ['OpenRouter', /openrouter/i], ['Groq', /groq(?!k)/i], ['Cerebras', /cerebras/i], ['硅基流动', /siliconflow|硅基流动/i], ['NVIDIA', /nvidia|nim/i],
  ['Cursor', /cursor/i], ['Windsurf', /windsurf|codeium/i], ['GitHub', /github copilot|github models/i], ['Perplexity', /perplexity/i], ['Hugging Face', /hugging ?face/i],
  ['Cloudflare', /cloudflare workers ai|workers ai/i], ['Fireworks', /fireworks/i], ['Together', /together\.ai|together ai/i], ['公益站', /公益站|中转站|new ?api/i],
];
export function guessVendor(text) {
  const t = String(text || '').replace(/^(【[^】]*】|\[[^\]]*\]|额度变化\s*·\s*)+/, '').trim().slice(0, 400);
  let best = null, at = Infinity;
  for (const [n, re] of VENDORS) { const m = re.exec(t); if (m && m.index < at) { best = n; at = m.index; } }
  // 标题开头就是一个英文产品名（如「packet.ai Token Factory 限时免费…」）而已知厂商出现得更晚：用开头这个
  const head = /^([A-Za-z][\w.+-]{1,24})(?=\s|：|:|，|的|上线|推出|限时|免费|送|宣布)/.exec(t);
  if (head && (best === null || at > head[1].length + 2) && !/^(AI|API|LLM|GPT|Free|The|New|Pro)$/i.test(head[1])) return head[1];
  return best;
}
// 福利类型
const PERKS_TYPE = [
  ['优惠码', /优惠码|兑换码|折扣码|promo code|coupon|redeem/i], ['公益站', /公益站|中转站|new ?api|签到/i], ['免费会员', /免费(领|送|获得)?.{0,6}(会员|pro|plus|max|studio|一个月|1 ?个月|月卡)|free (month|pro|plus)/i],
  ['赠金', /送\s*[$¥￥]?\s*\d+\s*(刀|美元|美金|元|积分|credits?)|赠金|赠送.{0,6}(额度|积分|credits?)|\$\d+\s*(free )?credits?|免费.{0,4}\d+\s*(刀|美元|积分)/i],
  ['限时免费', /限时免费|限免|免费开放|限时.{0,6}免费|free for a limited time|limited[- ]time free/i], ['免费额度', /免费额度|免费层|免费档|free tier|free plan|每日.{0,6}(次|额度)|免费调用|免费模型|:free/i],
];
export function guessPerk(text) {
  const t = String(text || '').slice(0, 600);
  for (const [n, re] of PERKS_TYPE) if (re.test(t)) return n;
  return null;
}
export const PERK_TYPES = PERKS_TYPE.map((x) => x[0]).concat('其它');

export const DEFAULT_RADAR_QUERIES = ['AI 限时免费 送额度', '大模型 API 免费额度 活动', '注册送 美元 额度 API', 'AI 编程助手 免费 Pro', 'AI 公益站 注册送额度', '免费 Token 活动 大模型'];
export const DEFAULT_RADAR_VENDORS = ['Claude', 'Gemini', 'ChatGPT', 'DeepSeek', '通义千问 Qwen', 'Kimi', '智谱 GLM', '豆包 火山方舟', 'MiniMax', 'Grok', 'Cursor', 'GitHub Copilot', 'OpenRouter', '硅基流动', 'Trae', 'Perplexity'];
/** 这一轮要搜的词：固定的福利词 + 轮流挑几个厂商（每个厂商一句「xx 免费 额度 福利」） */
export function radarQueries(s, round) {
  const base = String(s.aifree_queries || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const vendors = String(s.aifree_vendors || '').split(/\r?\n|,|，/).map((x) => x.trim()).filter(Boolean);
  const n = Math.min(8, Math.max(0, Number(s.aifree_vendors_per_run) || 4));
  const pick = [];
  for (let i = 0; i < Math.min(n, vendors.length); i++) pick.push(vendors[(round * n + i) % vendors.length]);
  const qBase = Math.max(1, Math.min(8, Number(s.search_max_queries) || 6) - pick.length);
  // 基础词也轮换，保证每轮总数不超过 search_max_queries
  const b = [];
  for (let i = 0; i < Math.min(qBase, base.length); i++) b.push(base[(round * qBase + i) % base.length]);
  return [...b, ...pick.map((v) => `${v} 免费 额度 福利`)];
}
