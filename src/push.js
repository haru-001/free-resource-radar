// 推送渠道（Webhook 类）：企业微信、钉钉、飞书、Server 酱、Bark、PushPlus、通用 Webhook
// 邮件和 Telegram 在 mailer.js；这里的渠道都是“一个地址 / 一个 Key 就能推”的机器人

import { CATEGORIES } from './categories.js';

const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
const OBTAIN_ZH = { free: '直接白嫖', conditional: '有条件', lottery: '抽奖', trial: '试用', promo: '推广', paid: '需付费' };

export const PUSH_CHANNELS = [
  { id: 'wecom', name: '企业微信机器人', key: 'wecom_webhook', hint: '群机器人的 Webhook 地址（https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…）' },
  { id: 'dingtalk', name: '钉钉机器人', key: 'dingtalk_webhook', secret: 'dingtalk_secret', hint: '自定义机器人的 Webhook 地址；安全设置选「加签」时把密钥填到下面，选「自定义关键词」时关键词填：免费资源雷达' },
  { id: 'feishu', name: '飞书机器人', key: 'feishu_webhook', secret: 'feishu_secret', hint: '自定义机器人的 Webhook 地址；开了签名校验就把密钥填到下面' },
  { id: 'serverchan', name: 'Server 酱（微信）', key: 'serverchan_key', hint: 'SendKey（sct.ftqq.com 或 Server 酱³ 的 sctp 开头的 Key）' },
  { id: 'pushplus', name: 'PushPlus（微信）', key: 'pushplus_token', hint: 'pushplus.plus 的 token' },
  { id: 'bark', name: 'Bark（iPhone）', key: 'bark_url', hint: 'Bark App 里复制的地址，如 https://api.day.app/你的Key' },
  { id: 'webhook', name: '通用 Webhook', key: 'webhook_url', hint: 'POST JSON：{title, text, items:[{title,url,summary,category}]}，可接 n8n / 自建服务' },
];
export const PUSH_KEYS = PUSH_CHANNELS.flatMap((c) => [c.key, c.secret].filter(Boolean));
export const pushReady = (s, c) => !!String(s[c.key] || '').trim() && s[`${c.id}_enabled`] !== 'false';

const line = (it) => {
  const tags = [CAT[it.category] || '', it.obtain && OBTAIN_ZH[it.obtain] && it.obtain !== 'free' ? OBTAIN_ZH[it.obtain] : '', it.expires_at ? '截止 ' + new Date(it.expires_at + 8 * 3600000).toISOString().slice(5, 10) : ''].filter(Boolean).join(' · ');
  return { name: String(it.name || it.title).slice(0, 80), url: it.url, summary: String(it.summary || '').slice(0, 90), tags };
};
/** Markdown 正文（企业微信 / 钉钉 / Server 酱 / PushPlus 通用），超出 max 字节截断 */
function markdown(title, items, max, siteUrl) {
  let out = `### ${title}\n`;
  let n = 0;
  for (const it of items) {
    const l = line(it);
    const block = `\n- [${l.name.replace(/[[\]]/g, '')}](${l.url})${l.summary ? `\n  ${l.summary}` : ''}${l.tags ? `\n  <font color="comment">${l.tags}</font>` : ''}`;
    if (new TextEncoder().encode(out + block).length > max - 200) break;
    out += block;
    n++;
  }
  if (n < items.length) out += `\n\n……还有 ${items.length - n} 条${siteUrl ? `，[查看全部](${siteUrl})` : ''}`;
  else if (siteUrl) out += `\n\n[查看全部](${siteUrl})`;
  if (!items.length) out += '\n今天没有新的资源。';
  return out;
}
const plain = (title, items, siteUrl) => [title, '', ...items.slice(0, 30).map((it, i) => { const l = line(it); return `${i + 1}. ${l.name}\n${l.url}${l.summary ? '\n' + l.summary : ''}`; }), items.length > 30 ? `……还有 ${items.length - 30} 条` : '', siteUrl ? `查看全部：${siteUrl}` : ''].filter((x) => x !== '').join('\n');

async function hmacB64(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
  return btoa(String.fromCharCode(...sig));
}
async function post(url, body, type = 'json') {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': type === 'json' ? 'application/json' : 'application/x-www-form-urlencoded' },
    body: type === 'json' ? JSON.stringify(body) : new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(15000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 160)}`);
  let j = {};
  try { j = JSON.parse(t); } catch {}
  // 各家机器人失败时 HTTP 也是 200，看返回码
  const code = j.errcode ?? j.code ?? j.StatusCode ?? 0;
  if (code !== 0 && code !== 200 && code !== '0') throw new Error(j.errmsg || j.msg || j.message || `返回码 ${code}`);
  return j;
}

/** 推送到一个渠道 */
export async function pushTo(id, s, title, items) {
  const c = PUSH_CHANNELS.find((x) => x.id === id);
  if (!c) throw new Error('未知渠道');
  const v = String(s[c.key] || '').trim();
  if (!v) throw new Error(`未填写${c.name}`);
  const site = (s.mail_site_url || '').replace(/\/+$/, '');
  switch (id) {
    case 'wecom':
      return post(v, { msgtype: 'markdown', markdown: { content: markdown(title, items, 4000, site) } });
    case 'dingtalk': {
      let url = v;
      if (s.dingtalk_secret) { const ts = Date.now(); url += `${url.includes('?') ? '&' : '?'}timestamp=${ts}&sign=${encodeURIComponent(await hmacB64(s.dingtalk_secret, `${ts}\n${s.dingtalk_secret}`))}`; }
      return post(url, { msgtype: 'markdown', markdown: { title: `免费资源雷达 · ${title}`.slice(0, 60), text: markdown(`免费资源雷达 · ${title}`, items, 18000, site) } });
    }
    case 'feishu': {
      const body = { msg_type: 'text', content: { text: `免费资源雷达 · ${plain(title, items, site)}`.slice(0, 18000) } };
      if (s.feishu_secret) { const ts = Math.floor(Date.now() / 1000); body.timestamp = String(ts); body.sign = await hmacB64(`${ts}\n${s.feishu_secret}`, ''); }
      return post(v, body);
    }
    case 'serverchan': {
      const m = /^sctp(\d+)t/i.exec(v);
      const url = m ? `https://${m[1]}.push.ft07.com/send/${v}.send` : `https://sctapi.ftqq.com/${v}.send`;
      return post(url, { title: title.slice(0, 32), desp: markdown(title, items, 30000, site) }, 'form');
    }
    case 'pushplus':
      return post('https://www.pushplus.plus/send', { token: v, title: title.slice(0, 100), content: markdown(title, items, 18000, site), template: 'markdown' });
    case 'bark': {
      const first = items[0];
      return post(v.replace(/\/+$/, ''), { title: title.slice(0, 60), body: items.length ? items.slice(0, 5).map((it) => '· ' + (it.name || it.title)).join('\n') + (items.length > 5 ? `\n…共 ${items.length} 条` : '') : '今天没有新的资源', group: '免费资源雷达', url: items.length === 1 ? first.url : site || undefined });
    }
    case 'webhook':
      return post(v, { title, text: plain(title, items, site), items: items.map((it) => ({ title: it.name || it.title, url: it.url, summary: it.summary || '', category: it.category, obtain: it.obtain || null, expires_at: it.expires_at || null })) });
  }
}

/** 推送到所有已填写的 Webhook 类渠道；返回成功的渠道名和错误 */
export async function pushAll(s, title, items, only) {
  const ok = [], errors = [];
  for (const c of PUSH_CHANNELS) {
    if (only ? c.id !== only : !pushReady(s, c)) continue;
    try { await pushTo(c.id, s, title, items); ok.push(c.name); } catch (e) { errors.push(`${c.name}：${e.message}`); }
  }
  return { ok, errors };
}
