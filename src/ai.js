// OpenAI 兼容接口：模型列表、对话、AI 判定、联网搜索

export function normalizeBase(u) {
  return String(u || '').trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '').replace(/\/models$/, '');
}

export async function listModels(baseUrl, apiKey) {
  const r = await fetch(normalizeBase(baseUrl) + '/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(20000),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`获取模型失败 HTTP ${r.status}: ${text.slice(0, 200)}`);
  const j = JSON.parse(text);
  const arr = j.data || j.models || (Array.isArray(j) ? j : []);
  return arr.map((m) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean).sort();
}

export async function chat({ baseUrl, apiKey, model, messages, extra = {}, temperature = 0.1, timeout = 120000 }) {
  if (!baseUrl || !apiKey || !model) throw new Error('AI 未配置完整（URL / Key / 模型）');
  const body = { model, messages, temperature, ...extra };
  const r = await fetch(normalizeBase(baseUrl) + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`AI HTTP ${r.status}: ${text.slice(0, 300)}`);
  const j = JSON.parse(text);
  const msg = j.choices?.[0]?.message || {};
  let content = msg.content;
  if (Array.isArray(content)) content = content.map((c) => c.text || '').join('');
  return String(content || '');
}

// 从模型输出中尽量提取 JSON
export function extractJson(text) {
  let t = String(text || '').trim();
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch {}
  const starts = [t.indexOf('{'), t.indexOf('[')].filter((i) => i >= 0);
  if (!starts.length) throw new Error('模型输出中没有 JSON');
  const start = Math.min(...starts);
  const close = t[start] === '{' ? '}' : ']';
  const end = t.lastIndexOf(close);
  return JSON.parse(t.slice(start, end + 1));
}

import { CAT_MAP, enabledCats } from './categories.js';

const catLine = (s) => enabledCats(s).map((k) => `${k}=${CAT_MAP[k].label}`).join('，');
const judgePrompt = (s) => `你是"免费资源 / 白嫖福利"审核员。逐条判断输入的帖子或页面，只输出严格 JSON。
关注的分类（category 只能取这些 key，不属于任何一类填 other）：${catLine(s)}。
判定规则：
1. relevant：内容确实在提供或介绍【可免费获得】且属于上述分类的资源（免费额度、限免、赠送、免费套餐等）。以下情况为 false：纯讨论或求助、付费促销或打折（非免费）、已失效 / 已关闭 / 已售罄 / 已领完、广告或明显不可信、新闻资讯。
2. simple_signup：只需邮箱，或 GitHub / Google 等第三方账号即可注册使用 → true。需要信用卡 / PayPal 绑卡、手机号短信验证、实名 / KYC / 身份证、邀请码、人工审核申请、先付费 → false。信息不足时按常识谨慎判断，并在 signup 字段写明依据。
3. obtain：获取方式，只能是 free（直接白嫖，注册即用）、conditional（需要完成简单任务，如回帖、邀请、签到）、lottery（抽奖 / 名额随机）、trial（限时试用，到期收费）、promo（商家推广引流）、paid（需要付费）。
4. score：0-100 的整数，综合相关性、注册简易度、资源价值、可信度、是否长期可用。
输出格式：{"results":[{"i":序号,"relevant":true,"category":"分类key","obtain":"free","simple_signup":true,"signup":"注册要求，15字内","name":"服务或资源名称","summary":"一句话中文简介，40字内","score":80}]}`;

export async function judgeBatch(items, s) {
  const payload = items.map((it, i) => ({
    i,
    title: it.title,
    url: it.url,
    source: it.source,
    date: it.published_at ? new Date(it.published_at).toISOString().slice(0, 10) : null,
    text: String(it.raw_text || '').slice(0, 700),
  }));
  const content = await chat({
    baseUrl: s.ai_base_url,
    apiKey: s.ai_api_key,
    model: s.ai_model,
    messages: [
      { role: 'system', content: judgePrompt(s) },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  });
  const j = extractJson(content);
  const results = Array.isArray(j) ? j : j.results || [];
  const map = new Map();
  for (const r of results) if (r && Number.isInteger(Number(r.i))) map.set(Number(r.i), r);
  return map;
}
