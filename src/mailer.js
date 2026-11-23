// 邮件日报：SMTP / Resend / Brevo
import { getSettings, saveSettings, getMeta, setMeta } from './db.js';
import { foldItems } from './fold.js';
import { CATEGORIES, mailCats } from './categories.js';
import { PUSH_CHANNELS, pushReady, pushAll } from './push.js';
import { weeklyPicks } from './extras.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const recipients = (s) => [...new Set(String(s || '').split(/[,;，；\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))].slice(0, 10);
const ymd = (t) => new Date(t + 8 * 3600000).toISOString().slice(0, 10); // 按北京时间显示日期
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
const OBTAIN_ZH = { free: '直接白嫖', conditional: '有条件', lottery: '抽奖', trial: '试用', promo: '推广', paid: '需付费' };

// ---------- 内容 ----------
export async function collectDigest(env, s) {
  const onlyNew = s.mail_only_new !== 'false';
  const since = onlyNew ? Number(s.mail_last_sent_at) || 0 : 0;
  const cutoff = Date.now() - (Number(s.max_age_days) || 180) * 86400000;
  const limit = Math.min(200, Number(s.mail_max_items) || 60);
  const cats = mailCats(s);
  const order = CATEGORIES.map((c, i) => `WHEN '${c.key}' THEN ${i}`).join(' ');
  const { results } = await env.DB.prepare(
    `SELECT * FROM items WHERE status = 'approved' AND dead = 0 AND (expires_at IS NULL OR expires_at > ${Date.now()}) AND COALESCE(judged_at, fetched_at) > ? AND (published_at IS NULL OR published_at >= ?)
     AND category IN (${cats.map(() => '?').join(',')})
     ORDER BY CASE category ${order} ELSE 99 END, COALESCE(published_at, fetched_at) DESC LIMIT ?`
  ).bind(since, cutoff, ...cats, limit * 2).all();
  const min = Number(s.mail_min_score) || 0;
  let list = (results || []).filter((it) => !min || it.score == null || it.score >= min);
  if (s.mail_dedup !== 'false' && onlyNew && env) {
    let sent = []; try { sent = JSON.parse((await getMeta(env, 'mailed')) || '[]'); } catch {}
    const seen = new Set(sent);
    list = list.filter((it) => !seen.has(it.id) && !(it.target && seen.has('t:' + it.target)));
  }
  return foldItems(list.slice(0, limit));
}
// 记住推过的条目（最多 1500 个），早晚报不重复
async function rememberMailed(env, items) {
  let sent = []; try { sent = JSON.parse((await getMeta(env, 'mailed')) || '[]'); } catch {}
  const add = items.flatMap((it) => [it.id, it.target ? 't:' + it.target : null]).filter(Boolean);
  await setMeta(env, 'mailed', JSON.stringify([...new Set([...add, ...sent])].slice(0, 1500)));
}

const xo = (it) => { if (it._x) return it._x; let x = it.extra; if (typeof x === 'string') { try { x = JSON.parse(x); } catch { x = null; } } return (it._x = x || {}); };
// 邮件 HTML：表格布局 + 内联样式，兼容 Gmail / Outlook / QQ / 163 / Apple Mail 和手机端
export function renderDigest(items, s, dateStr) {
  const groups = {};
  // 发布超过 fresh_days 天的单独放到最后一组
  const freshMs = Math.max(1, Number(s.fresh_days) || 15) * 86400000;
  const oldKey = `较早发布（${Math.max(1, Number(s.fresh_days) || 15)} 天前）`;
  for (const it of items) (groups[s._flat ? '_flat' : it.published_at && Date.now() - it.published_at > freshMs ? oldKey : it.category || 'other'] ||= []).push(it);
  if (groups[oldKey]) { const o = groups[oldKey]; delete groups[oldKey]; groups[oldKey] = o; }
  const siteUrl = (s.mail_site_url || '').replace(/\/+$/, '');
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',Arial,sans-serif";

  const COLOR = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.color || '#4f46e5']));
  const pill = (txt, fg, bg) => `<span style="display:inline-block;font-size:12px;line-height:18px;padding:1px 8px;border-radius:10px;color:${fg};background:${bg};margin:0 4px 4px 0;white-space:nowrap;">${txt}</span>`;
  const btn = (href, txt, solid) => `<a href="${esc(href)}" target="_blank" style="display:inline-block;font-size:13px;line-height:20px;padding:5px 14px;border-radius:6px;text-decoration:none;font-weight:bold;margin:8px 8px 0 0;${solid ? 'background:#4f46e5;color:#ffffff;border:1px solid #4f46e5;' : 'background:#ffffff;color:#4f46e5;border:1px solid #c7d2fe;'}">${txt}</a>`;
  const card = (it, color, rank) => {
    const x = xo(it);
    const title = x.zh || it.name || it.title;
    const pills = [
      it.obtain && OBTAIN_ZH[it.obtain] ? pill(OBTAIN_ZH[it.obtain], it.obtain === 'free' ? '#047857' : '#92400e', it.obtain === 'free' ? '#ecfdf5' : '#fffbeb') : '',
      x.perk ? pill(esc(x.perk), '#4f46e5', '#eef2ff') : '',
      it.expires_at ? pill('截止 ' + ymd(it.expires_at), '#b91c1c', '#fef2f2') : '',
      it.signup ? pill('注册：' + esc(it.signup), '#4b5563', '#f3f4f6') : '',
    ].join('');
    return `
<tr><td style="padding:0 20px 12px;">
<table class="dk-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e6e8ec;border-left:3px solid ${color};border-radius:8px;background:#ffffff;">
<tr><td style="padding:14px 16px;font-family:${font};">
  ${pills ? `<div>${pills}</div>` : ''}
  ${rank ? `<span style="display:inline-block;min-width:22px;height:22px;line-height:22px;text-align:center;border-radius:11px;background:${rank <= 3 ? '#4f46e5' : '#e5e7eb'};color:${rank <= 3 ? '#ffffff' : '#374151'};font-size:12px;font-weight:bold;margin-right:6px;vertical-align:1px;">${rank}</span>` : ''}<a class="dk-t" href="${esc(it.url)}" target="_blank" style="font-size:16px;font-weight:bold;color:#111318;text-decoration:none;line-height:1.5;word-break:break-word;">${esc(title)}</a>
  ${x.zh || (it.name && it.name !== it.title) ? `<div style="font-size:12px;color:#9ca3af;line-height:1.5;margin-top:2px;word-break:break-word;">${esc(it.title)}</div>` : ''}
  ${it.summary ? `<div class="dk-s" style="font-size:14px;color:#374151;line-height:1.7;margin-top:8px;">${esc(it.summary)}</div>` : ''}
  ${x.how ? `<div style="font-size:13px;color:#1f2937;line-height:1.6;margin-top:8px;padding:8px 10px;background:#f6f7f9;border-radius:6px;">👉 ${esc(x.how)}</div>` : ''}
  ${x.codes && x.codes.length ? `<div style="margin-top:8px;">${x.codes.map((c) => `<span style="display:inline-block;font-family:Menlo,Consolas,monospace;font-size:13px;padding:3px 8px;border:1px dashed #d97706;color:#92400e;background:#fffbeb;border-radius:4px;margin:0 6px 4px 0;">${esc(c)}</span>`).join('')}</div>` : ''}
  <div>${btn(it.url, '查看详情', true)}${x.project ? btn(x.project, '项目地址', false) : ''}</div>
  <div style="font-size:12px;color:#9ca3af;line-height:1.6;margin-top:10px;">${it.published_at ? ymd(it.published_at) + ' · ' : ''}${esc(it.srcs ? it.srcs.map((y) => y.n).join(' / ') : it.source || '')}${it.score != null ? ' · ' + it.score + ' 分' : ''}</div>
</td></tr></table>
</td></tr>`;
  };
  const section = (cat, list) => {
    const color = COLOR[cat] || '#9ca3af';
    return `${cat === '_flat' ? '<tr><td style="height:12px;"></td></tr>' : `
<tr><td style="padding:22px 20px 10px;font-family:${font};">
  <span style="display:inline-block;width:4px;height:16px;background:${color};border-radius:2px;vertical-align:-2px;margin-right:8px;"></span><span class="dk-h" style="font-size:17px;font-weight:bold;color:#111827;">${esc(CAT[cat] || cat)}</span>
  <span style="font-size:12px;color:#6b7280;background:#f3f4f6;border-radius:10px;padding:1px 8px;margin-left:6px;">${list.length}</span>
</td></tr>`}${list.map((it, i) => card(it, color, cat === '_flat' && s._weekly ? i + 1 : 0)).join('')}`;
  };
  const keys = [...Object.keys(CAT), oldKey, '_flat'].filter((c) => groups[c]);
  const overview = items.length && !s._flat ? keys.map((c) => `<span style="display:inline-block;font-size:12px;color:#e0e7ff;background:rgba(255,255,255,.14);border-radius:10px;padding:2px 9px;margin:8px 6px 0 0;white-space:nowrap;">${esc(CAT[c] || c)} ${groups[c].length}</span>`).join('') : '';

  const topN = s._flat ? 0 : Math.min(5, Math.max(0, Number(s.mail_top_n ?? 3)));
  const tops = topN && items.length > topN + 2 ? [...items].filter((it) => it.score != null).sort((a, b) => b.score - a.score).slice(0, topN) : [];
  const topBlock = tops.length ? `
<tr><td style="padding:16px 20px 4px;font-family:${font};"><span style="font-size:17px;font-weight:bold;color:#111827;">⭐ 今日精选</span><span style="font-size:12px;color:#6b7280;margin-left:8px;">按综合分挑出 ${tops.length} 条，最值得先看</span></td></tr>
<tr><td style="padding:6px 20px 4px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;">
${tops.map((it, i) => `<tr><td style="padding:12px 14px;${i ? 'border-top:1px solid #c7d2fe;' : ''}font-family:${font};">
  <span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;border-radius:10px;background:#4f46e5;color:#fff;font-size:12px;font-weight:bold;margin-right:6px;">${i + 1}</span><a href="${esc(it.url)}" target="_blank" style="font-size:15px;font-weight:bold;color:#1e1b4b;text-decoration:none;">${esc(xo(it).zh || it.name || it.title)}</a>
  ${it.summary ? `<div style="font-size:13px;color:#3730a3;line-height:1.6;margin:4px 0 0 26px;">推荐理由：${esc(it.summary)}</div>` : ''}
</td></tr>`).join('')}
</table></td></tr>` : '';
  const body = items.length
    ? topBlock + keys.map((c) => section(c, groups[c])).join('')
    : `<tr><td style="padding:30px 24px;font-family:${font};font-size:14px;color:#6b7280;text-align:center;">今天没有新的资源。</td></tr>`;

  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(s.mail_subject)}</title>
<!--[if mso]><style>table,td,a,div{font-family:'Microsoft YaHei',Arial,sans-serif !important;}</style><![endif]-->
<style>@media (prefers-color-scheme:dark){body,.dk-bg{background:#0d0f13 !important}.container{background:#15181e !important;border-color:#252a33 !important}.dk-card{background:#1b1f26 !important;border-color:#2b313b !important}.dk-t,.dk-h{color:#eef0f4 !important}.dk-s{color:#cfd4dc !important}}
@media only screen and (max-width:620px){.container{width:100% !important;border-radius:0 !important;border:0 !important;}}</style>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${items.length ? `今日 ${items.length} 条新资源：${esc(items.slice(0, 3).map((i) => i.name || i.title).join('、'))}` : '今天没有新资源'}</div>
<table class="dk-bg" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f7f9;">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#f9fafb;border-radius:10px;border:1px solid #e6e8ec;">
<tr><td style="padding:26px 24px 22px;background:#312e81;background-image:linear-gradient(135deg,#312e81,#4f46e5);border-radius:10px 10px 0 0;font-family:${font};">
  <div style="font-size:12px;color:#c7d2fe;letter-spacing:1px;">免费资源雷达 · ${dateStr}</div>
  <div style="font-size:22px;font-weight:bold;color:#ffffff;margin-top:6px;line-height:1.4;">${esc(s.mail_subject)}</div>
  <div style="font-size:14px;color:#e0e7ff;margin-top:6px;">${s._weekly ? '本周精选' : '今天共'} <b style="font-size:18px;color:#ffffff;">${items.length}</b> 条 · ${esc(s._sub || '只收录半年内、注册简单的免费资源')}</div>
  ${overview ? `<div>${overview}</div>` : ''}
</td></tr>
<tr><td style="height:8px;"></td></tr>
${body}
<tr><td align="center" style="padding:20px 24px 24px;font-family:${font};font-size:12px;color:#9ca3af;line-height:1.7;border-top:1px solid #e6e8ec;">
  ${siteUrl ? `<a href="${esc(siteUrl)}" target="_blank" style="display:inline-block;background:#111318;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:9px 22px;border-radius:6px;margin-bottom:10px;">查看全部资源 →</a><br><a href="${esc(siteUrl)}/feed.xml" target="_blank" style="color:#9ca3af;">RSS 订阅</a><br>` : ''}
  由免费资源雷达自动抓取并经 AI 筛选，使用前请自行确认服务条款。
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [`${s.mail_subject} · ${dateStr} · 共 ${items.length} 条`, '']
    .concat(items.length ? [...Object.keys(CAT), oldKey, '_flat'].filter((c) => groups[c]).flatMap((c) => [
      c === '_flat' ? '' : `【${CAT[c] || c}】`,
      ...groups[c].map((it, i) => `${i + 1}. ${xo(it).zh || it.name || it.title}\n   ${it.url}${xo(it).project ? '\n   项目地址：' + xo(it).project : ''}${it.summary ? '\n   ' + it.summary : ''}${it.signup ? '\n   注册：' + it.signup : ''}`),
      '',
    ]) : ['今天没有新的资源。'])
    .concat(siteUrl ? [`查看全部：${siteUrl}`] : [])
    .join('\n');
  return { html, text };
}

// ---------- 发送 ----------
const b64 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n').trim();
const encHeader = (s) => `=?UTF-8?B?${b64(s)}?=`;

function buildMime({ fromName, from, to, subject, html, text }) {
  const toList = Array.isArray(to) ? to : [to];
  const boundary = 'b_' + crypto.randomUUID().replace(/-/g, '');
  const domain = from.split('@')[1] || 'localhost';
  return [
    `From: ${encHeader(fromName)} <${from}>`,
    `To: ${toList.map((a) => `<${a}>`).join(', ')}`,
    `Subject: ${encHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(text)),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(html)),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

// 多个收件人：默认每人单独发一封（互相看不到地址），某个地址失败不影响其它
export async function sendMail(env, s, msg) {
  const all = recipients(s.mail_to);
  if (!all.length) throw new Error('未填写有效的收件人');
  if (s.mail_separate === 'false' || all.length === 1) return sendMailTo(env, s, msg, all);
  const ok = [], failed = [];
  for (const addr of all) {
    try { await sendMailTo(env, s, msg, [addr]); ok.push(addr); } catch (e) { failed.push(`${addr}：${e.message}`); }
  }
  if (!ok.length) throw new Error(failed.join('；'));
  return { provider: s.mail_provider || 'smtp', to: ok, failed };
}

async function sendMailTo(env, s, { subject, html, text }, to) {
  const provider = s.mail_provider || 'smtp';
  const fromName = s.mail_from_name || '免费资源雷达';

  if (provider === 'smtp') {
    if (!s.smtp_user || !s.smtp_pass) throw new Error('未填写 SMTP 账号或授权码');
    const from = s.mail_from || s.smtp_user; // QQ 邮箱要求发件地址与登录账号一致
    const { smtpSend } = await import('./smtp.js');
    const raw = buildMime({ fromName, from, to, subject, html, text });
    await smtpSend({ host: s.smtp_host || 'smtp.qq.com', port: s.smtp_port || 465, secure: s.smtp_secure || 'ssl', user: s.smtp_user, pass: s.smtp_pass, from, to, raw });
    return { provider, to };
  }
  if (!s.mail_from) throw new Error('未填写发件地址');

  if (provider === 'resend') {
    if (!s.mail_api_key) throw new Error('未填写 Resend API Key');
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.mail_api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `${fromName} <${s.mail_from}>`, to, subject, html, text }),
    });
    if (!r.ok) throw new Error(`Resend HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return { provider, to };
  }
  if (provider === 'brevo') {
    if (!s.mail_api_key) throw new Error('未填写 Brevo API Key');
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': s.mail_api_key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: { name: fromName, email: s.mail_from }, to: to.map((email) => ({ email })), subject, htmlContent: html, textContent: text }),
    });
    if (!r.ok) throw new Error(`Brevo HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return { provider, to };
  }
  if (provider === 'cloudflare') throw new Error('Vercel 版不支持 Cloudflare Email，请在后台把发送方式改成 SMTP、Resend 或 Brevo');
  throw new Error(`未知的邮件服务：${provider}`);
}

export async function previewDigest(env) {
  const s = await getSettings(env);
  const items = await collectDigest(env, s);
  return renderDigest(items, s, ymd(Date.now())).html;
}

// ---------- Telegram ----------
const tgEsc = (x) => String(x ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export async function sendTelegram(s, items, title) {
  if (!s.telegram_bot_token || !s.telegram_chat_id) throw new Error('未填写 Telegram Bot Token 或 Chat ID');
  const blocks = items.map((it) => {
    const tags = [CAT[it.category] || '', it.obtain ? OBTAIN_ZH[it.obtain] : '', it.signup ? `注册：${it.signup}` : ''].filter(Boolean).join(' · ');
    return `▪️ <a href="${tgEsc(it.url)}">${tgEsc(xo(it).zh || it.name || it.title)}</a>${xo(it).project ? ` · <a href="${tgEsc(xo(it).project)}">项目地址</a>` : ''}${it.summary ? `\n${tgEsc(it.summary)}` : ''}${tags ? `\n<i>${tgEsc(tags)}</i>` : ''}`;
  });
  const head = `<b>${tgEsc(title)}</b>`;
  const msgs = [];
  let cur = head;
  for (const b of blocks.length ? blocks : ['今天没有新的资源。']) {
    if ((cur + '\n\n' + b).length > 3800) { msgs.push(cur); cur = b; } else cur += '\n\n' + b;
  }
  msgs.push(cur);
  for (const text of msgs) {
    const r = await fetch(`https://api.telegram.org/bot${s.telegram_bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: s.telegram_chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(`Telegram 发送失败：${j.description || r.status}`);
  }
  return { provider: 'telegram', to: [String(s.telegram_chat_id)] };
}

// ---------- 推送：邮件、Telegram 和各种 Webhook 机器人共用 ----------
export function channelsOf(env, s) {
  const mailReady = !!String(s.mail_to || '').trim() && (s.mail_provider === 'smtp' || !s.mail_provider ? !!(s.smtp_user && s.smtp_pass) : s.mail_provider === 'cloudflare' ? !!s.mail_from : !!(s.mail_api_key && s.mail_from));
  const tgReady = !!(s.telegram_bot_token && s.telegram_chat_id);
  return [s.mail_enabled === 'true' && mailReady && 'mail', s.telegram_enabled === 'true' && tgReady && 'telegram', ...PUSH_CHANNELS.filter((c) => pushReady(s, c)).map((c) => 'push:' + c.id)].filter(Boolean);
}
/** 把一组条目推到所有可用渠道（channel 指定时只推这一个：mail / telegram / push:wecom …） */
export async function deliver(env, s, { kind = 'digest', title, items, channel, sub } = {}) {
  const channels = channel ? [channel] : channelsOf(env, s);
  if (!channels.length) return { skipped: '没有可用的推送渠道（邮件需填写账号、授权码和收件人，或配置 Telegram / 微信 / 钉钉 / 飞书等机器人）' };
  const dateStr = ymd(Date.now());
  const results = [], errors = [];
  for (const ch of channels) {
    try {
      if (ch === 'mail') {
        const r = await sendMail(env, s, { subject: title, ...renderDigest(items, { ...s, mail_subject: title.replace(/ · \d{4}-\d{2}-\d{2}.*$/, ''), _flat: kind !== 'digest', _weekly: kind === 'weekly', _sub: sub }, dateStr) });
        if (r.failed?.length) errors.push('部分邮件失败：' + r.failed.join('；'));
        results.push(r);
      } else if (ch === 'telegram') results.push(await sendTelegram(s, items, title));
      else {
        const id = ch.slice(5);
        const r = await pushAll(s, title, items, id);
        if (r.ok.length) results.push({ provider: r.ok[0], to: [] }); else errors.push(...r.errors);
      }
    } catch (e) {
      errors.push(`${ch === 'mail' ? '邮件' : ch === 'telegram' ? 'Telegram' : ch}：${e.message}`);
    }
  }
  if (!results.length) throw new Error(errors.join('；'));
  return { sent: items.length, to: results.flatMap((r) => r.to || []), providers: results.map((r) => r.provider), errors };
}

// ---------- 定时任务 / 后台调用 ----------
// channel: 'mail' | 'telegram' | 'push:<id>' | undefined（按启用的渠道）
export async function sendDigest(env, { force = false, test = false, channel, label = '' } = {}) {
  const s = await getSettings(env);
  const startedAt = Date.now();
  if (!channel && !channelsOf(env, s).length) return { skipped: '没有可用的推送渠道（邮件需填写账号、授权码和收件人，或配置 Telegram / 微信 / 钉钉 / 飞书等机器人）' };
  const items = test ? (await collectDigest(env, { ...s, mail_only_new: 'false' })).slice(0, 5) : await collectDigest(env, s);
  if (!test && !items.length && s.mail_send_empty !== 'true') return { skipped: '没有新内容' };
  const dateStr = ymd(Date.now());
  const title = `${test ? '[测试] ' : ''}${s.mail_subject} · ${dateStr}${label ? ' ' + label : ''}${items.length ? `（${items.length} 条）` : ''}`;
  const r = await deliver(env, s, { title, items, channel });
  if (!test && !r.skipped) { await saveSettings(env, { mail_last_sent_at: String(startedAt) }); if (items.length) await rememberMailed(env, items).catch(() => {}); }
  return r;
}

/** 每周精选：近 7 天综合分最高的 10 条 */
export async function sendWeekly(env, { channel, test = false } = {}) {
  const s = await getSettings(env);
  const { results } = await env.DB.prepare("SELECT * FROM items WHERE status = 'approved' AND dead = 0 AND COALESCE(published_at, fetched_at) >= ? ORDER BY score DESC LIMIT 400").bind(Date.now() - 7 * 86400000).all();
  const items = weeklyPicks(foldItems(results || []).map((it) => { try { it.extra = it.extra ? JSON.parse(it.extra) : null; } catch { it.extra = null; } return it; }));
  if (!items.length) return { skipped: '这周没有可选的条目' };
  return deliver(env, s, { kind: 'weekly', title: `${test ? '[测试] ' : ''}免费资源雷达 · 本周精选 ${ymd(Date.now())}（${items.length} 条）`, items, channel, sub: '近 7 天综合 AI 评分、投票和来源数挑出的 10 条' });
}
