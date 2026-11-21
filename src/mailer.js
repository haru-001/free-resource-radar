// 邮件日报：Resend / Brevo / Cloudflare Email（send_email binding）
import { getSettings, saveSettings } from './db.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const recipients = (s) => String(s || '').split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
const ymd = (t) => new Date(t + 8 * 3600000).toISOString().slice(0, 10); // 按北京时间显示日期
const CAT = { domain: '免费域名', hosting: '免费虚拟主机', other: '其他' };
const OBTAIN_ZH = { free: '直接白嫖', conditional: '有条件', lottery: '抽奖', trial: '试用', promo: '推广', paid: '需付费' };

// ---------- 内容 ----------
export async function collectDigest(env, s) {
  const onlyNew = s.mail_only_new !== 'false';
  const since = onlyNew ? Number(s.mail_last_sent_at) || 0 : 0;
  const cutoff = Date.now() - (Number(s.max_age_days) || 180) * 86400000;
  const limit = Math.min(200, Number(s.mail_max_items) || 60);
  const { results } = await env.DB.prepare(
    `SELECT * FROM items WHERE status = 'approved' AND COALESCE(judged_at, fetched_at) > ? AND (published_at IS NULL OR published_at >= ?)
     ORDER BY CASE category WHEN 'domain' THEN 0 WHEN 'hosting' THEN 1 ELSE 2 END, score DESC, published_at DESC LIMIT ?`
  ).bind(since, cutoff, limit).all();
  return results || [];
}

// 邮件 HTML：表格布局 + 内联样式，兼容 Gmail / Outlook / QQ / 163 / Apple Mail 和手机端
export function renderDigest(items, s, dateStr) {
  const groups = {};
  for (const it of items) (groups[it.category || 'other'] ||= []).push(it);
  const siteUrl = (s.mail_site_url || '').replace(/\/+$/, '');
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei',Arial,sans-serif";

  const section = (cat, list) => `
<tr><td style="padding:22px 24px 6px;font-family:${font};font-size:16px;font-weight:bold;color:#111827;border-bottom:1px solid #e6e8ec;">${CAT[cat] || cat}（${list.length}）</td></tr>
${list.map((it) => `
<tr><td style="padding:14px 24px;border-bottom:1px solid #eeeeee;font-family:${font};">
  <a href="${esc(it.url)}" target="_blank" style="font-size:15px;font-weight:bold;color:#111318;text-decoration:none;line-height:1.5;word-break:break-all;">${esc(it.name || it.title)}</a>
  ${it.name && it.name !== it.title ? `<div style="font-size:12px;color:#9ca3af;line-height:1.5;margin-top:2px;">${esc(it.title)}</div>` : ''}
  ${it.summary ? `<div style="font-size:14px;color:#374151;line-height:1.6;margin-top:6px;">${esc(it.summary)}</div>` : ''}
  <div style="font-size:12px;color:#6b7280;line-height:1.6;margin-top:6px;">
    ${it.obtain ? `<span style="color:${it.obtain === 'free' ? '#047857' : '#92400e'};font-weight:bold;">${OBTAIN_ZH[it.obtain] || ''}</span>&nbsp; ` : ''}${it.signup ? `<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:4px;">注册：${esc(it.signup)}</span>&nbsp; ` : ''}
    ${it.published_at ? ymd(it.published_at) + ' · ' : ''}${esc(it.source || '')}${it.score != null ? ' · ' + it.score + '分' : ''}
  </div>
</td></tr>`).join('')}`;

  const body = items.length
    ? Object.keys(CAT).filter((c) => groups[c]).map((c) => section(c, groups[c])).join('')
    : `<tr><td style="padding:30px 24px;font-family:${font};font-size:14px;color:#6b7280;text-align:center;">今天没有新的资源。</td></tr>`;

  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<title>${esc(s.mail_subject)}</title>
<!--[if mso]><style>table,td,a,div{font-family:'Microsoft YaHei',Arial,sans-serif !important;}</style><![endif]-->
<style>@media only screen and (max-width:620px){.container{width:100% !important;}}</style>
</head>
<body style="margin:0;padding:0;background:#f6f7f9;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${items.length ? `今日 ${items.length} 条新资源：${esc(items.slice(0, 3).map((i) => i.name || i.title).join('、'))}` : '今天没有新资源'}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f7f9;">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:8px;">
<tr><td style="padding:22px 24px;background:#111318;border-radius:8px 8px 0 0;font-family:${font};">
  <div style="font-size:19px;font-weight:bold;color:#ffffff;">${esc(s.mail_subject)}</div>
  <div style="font-size:13px;color:#d1d5db;margin-top:4px;">${dateStr} · 共 ${items.length} 条 · 只收录半年内、注册简单的资源</div>
</td></tr>
${body}
<tr><td style="padding:18px 24px;font-family:${font};font-size:12px;color:#9ca3af;line-height:1.6;">
  ${siteUrl ? `<a href="${esc(siteUrl)}" target="_blank" style="color:#312e81;text-decoration:none;">查看全部资源 →</a>&nbsp;·&nbsp;<a href="${esc(siteUrl)}/feed.xml" target="_blank" style="color:#9ca3af;">RSS</a><br>` : ''}
  由 Cloudflare Workers 自动抓取并经 AI 筛选，使用前请自行确认服务条款。
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [`${s.mail_subject} · ${dateStr} · 共 ${items.length} 条`, '']
    .concat(items.length ? Object.keys(CAT).filter((c) => groups[c]).flatMap((c) => [
      `【${CAT[c]}】`,
      ...groups[c].map((it, i) => `${i + 1}. ${it.name || it.title}\n   ${it.url}${it.summary ? '\n   ' + it.summary : ''}${it.signup ? '\n   注册：' + it.signup : ''}`),
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

export async function sendMail(env, s, { subject, html, text }) {
  const to = recipients(s.mail_to);
  if (!to.length) throw new Error('未填写有效的收件人');
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
  if (provider === 'cloudflare') {
    if (!env.MAILER) throw new Error('未绑定 send_email（MAILER），请在 wrangler.toml 中开启并配置 Email Routing');
    const { EmailMessage } = await import('cloudflare:email');
    for (const addr of to) {
      const raw = buildMime({ fromName, from: s.mail_from, to: addr, subject, html, text });
      await env.MAILER.send(new EmailMessage(s.mail_from, addr, raw));
    }
    return { provider, to };
  }
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
    return `▪️ <a href="${tgEsc(it.url)}">${tgEsc(it.name || it.title)}</a>${it.summary ? `\n${tgEsc(it.summary)}` : ''}${tags ? `\n<i>${tgEsc(tags)}</i>` : ''}`;
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

// ---------- 定时任务 / 后台调用 ----------
// channel: 'mail' | 'telegram' | undefined（按启用的渠道）
export async function sendDigest(env, { force = false, test = false, channel } = {}) {
  const s = await getSettings(env);
  const startedAt = Date.now();
  const mailReady = !!String(s.mail_to || '').trim() && (s.mail_provider === 'smtp' || !s.mail_provider ? !!(s.smtp_user && s.smtp_pass) : s.mail_provider === 'cloudflare' ? !!s.mail_from : !!(s.mail_api_key && s.mail_from));
  const tgReady = !!(s.telegram_bot_token && s.telegram_chat_id);
  const channels = channel
    ? [channel]
    : [s.mail_enabled === 'true' && mailReady && 'mail', s.telegram_enabled === 'true' && tgReady && 'telegram'].filter(Boolean);
  if (!channels.length) return { skipped: '没有可用的推送渠道（邮件需填写账号、授权码和收件人，或配置 Telegram）' };
  const items = test ? (await collectDigest(env, { ...s, mail_only_new: 'false' })).slice(0, 5) : await collectDigest(env, s);
  if (!test && !items.length && s.mail_send_empty !== 'true') return { skipped: '没有新内容' };
  const dateStr = ymd(Date.now());
  const subject = `${test ? '[测试] ' : ''}${s.mail_subject} · ${dateStr}${items.length ? `（${items.length} 条）` : ''}`;
  const results = [];
  const errors = [];
  for (const ch of channels) {
    try {
      if (ch === 'mail') results.push(await sendMail(env, s, { subject, ...renderDigest(items, s, dateStr) }));
      else results.push(await sendTelegram(s, items, subject));
    } catch (e) {
      errors.push(`${ch === 'mail' ? '邮件' : 'Telegram'}：${e.message}`);
    }
  }
  if (!results.length) throw new Error(errors.join('；'));
  if (!test) await saveSettings(env, { mail_last_sent_at: String(startedAt) });
  return { sent: items.length, to: results.flatMap((r) => r.to), providers: results.map((r) => r.provider), errors };
}
