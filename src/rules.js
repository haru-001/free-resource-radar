// 规则层：噪音标题、获取方式、屏蔽规则、跨源去重指纹
// 部分规则移植并精简自 ZiChuanLan/freebie-radar（MIT License, Copyright (c) 2026 ZiChuanLan）

/** 社区求助 / 抱怨 / 水帖标题：命中直接跳过，不送 AI，省额度 */
const NOISE_TITLE =
  /^(怎样|怎么|如何|哪里|哪个|为什么|为何)|请问|有没有|求推荐|求一个|哪里(有|能)|值得买吗|怎么样[?？]|不够用|用完了|失效了|吐槽|踩坑|后悔|失望|谁有|求个|求购|哪有|多少钱|求助|求带|有人吗|有人知道|被封|封号|跑路|[?？]\s*$/;

/** 代理节点 / 翻墙类内容：一律不收录（Cloudflare 条款不允许） */
const PROXY_TOPIC = /梯子|翻墙|科学上网|机场|节点订阅|免费节点|v2ray|vless|vmess|trojan|shadowsocks|ssr?订阅|clash\s*(订阅|节点|meta)|代理节点|proxy\s*(pool|list|node)/i;
export function isProxyTopic(text) { return PROXY_TOPIC.test(String(text || '')); }

export function isNoiseTitle(title) {
  const t = String(title || '');
  // 明确的教程 / 指南不算求助
  if (/^(如何|怎么|怎样)/.test(t) && /教程|攻略|步骤|指南/.test(t) && !/请问|求助|有没有|失效|[?？]/.test(t)) return false;
  return NOISE_TITLE.test(t);
}

export const OBTAIN_LABEL = {
  free: '直接白嫖',
  conditional: '有条件',
  lottery: '抽奖',
  trial: '试用',
  promo: '推广',
  paid: '需付费',
};

/** 获取方式的规则兜底（AI 未判定时使用）。顺序有意为之：抽奖 > 推广 > 付费 > 试用 > 有条件 > 免费 */
/** 去掉「无需绑卡」「不用实名」这类否定说法，免得被当成要求 */
export const stripNegated = (t) => String(t || '').replace(/(无需|不需要|不需|不用|无须|免|不必|没有|no|without)\s*(绑定|绑)?\s*(信用卡|银行卡|绑卡|卡|实名|手机号?验证|手机号|短信验证|邀请码|充值|付费|kyc|credit card|phone verification)/gi, ' ');
export function guessObtain(title, summary = '') {
  const t = stripNegated(`${title} ${summary}`);
  if (/抽奖|抽\s*\d+\s*(份|个|名|位)|抽取|随机送|开奖|中奖|摇号|giveaway/i.test(t)) return 'lottery';
  if (/招募|代理|加盟|商务合作|招商|诚招|带货|优惠码.*分成|affiliate/i.test(t)) return 'promo';
  if (/(年付|月付|季付)\s*[$¥￥]?\s*\d|[$¥￥]\s*\d+(\.\d+)?\s*\/\s*(年|月|yr|year|mo|month)|首年\s*[$¥￥]?\d/i.test(t) && !/免费|free/i.test(t)) return 'paid';
  if (/试用|免费体验\s*\d+\s*天|首月免费|体验期|试用期|\d+\s*天免费|free\s+trial/i.test(t)) return 'trial';
  if (/回帖|盖楼|转发|关注.*领取|邀请|拉新|实名|绑卡|下单|首单|充值|发帖|签到.*领|分享.*得|credit\s*card|phone\s*verif/i.test(t)) return 'conditional';
  return 'free';
}

/** 屏蔽规则：每行一个；普通文本为关键词（不区分大小写），/xxx/i 形式为正则 */
export function compileBlockRules(text) {
  const rules = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^\/(.+)\/([gimsuy]*)$/);
    if (m) {
      try { rules.push({ label: line, test: (s) => new RegExp(m[1], m[2].replace('g', '')).test(s) }); } catch {}
    } else {
      const w = line.toLowerCase();
      rules.push({ label: line, test: (s) => s.toLowerCase().includes(w) });
    }
  }
  return rules;
}
export function matchBlock(rules, text) {
  for (const r of rules) if (r.test(text)) return r.label;
  return null;
}

/** 标题指纹：去掉标点、空白、常见前缀标签，用于跨源去重（同一活动被多个站转发） */
export function titleFingerprint(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/【[^】]*】|\[[^\]]*\]|\([^)]*\)|（[^）]*）/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 60);
}

// ---------- v1.8：标题清洗、截止时间、兑换码、一句话摘要 ----------
const SITE_TAIL = /(社区|论坛|博客|官网|网站|频道|之家|周刊|日报|资讯|新闻网|科技|分享|软件|吧|网|blog|news|forum|community)$/i;
const KNOWN_TAIL = /\s*[-_|｜–—]\s*(腾讯云开发者社区(-腾讯云)?|阿里云开发者社区|博客园|CSDN博客|CSDN|知乎专栏|知乎|掘金|简书|51CTO博客|开源中国|哔哩哔哩|bilibili|今日头条|网易|搜狐|新浪科技|IT之家|cnBeta\.COM|cnBeta)\s*$/i;
/** 去掉转载标记和「 - 站点名」这类后缀，标题更整齐 */
export function cleanTitle(title, source = '', url = '') {
  let t = String(title || '').replace(/[\u3000\s]+/g, ' ').trim();
  t = t.replace(/^(【\s*(转|转载|转帖|原创|分享|置顶|推荐)\s*】|\[\s*(转|转载|原创|分享|置顶)\s*\]|(转载|转帖)[:：])\s*/, '');
  t = t.replace(KNOWN_TAIL, '').trim();
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, '').split('.')[0].toLowerCase(); } catch {}
  const src = String(source || '').split(/[·\s|]/)[0].trim().toLowerCase();
  for (let k = 0; k < 2; k++) {
    const m = /\s*(?:\s[-–—|]\s|_|｜)\s*([^-–—|_｜]{2,24})$/.exec(t);
    if (!m) break;
    const tail = m[1].trim(), low = tail.toLowerCase();
    if (/免费|白嫖|领取|限免|赠送|送|额度|教程|下载/.test(tail)) break;
    if (!(SITE_TAIL.test(tail) || (src && (low.includes(src) || src.includes(low))) || (host && host.length > 2 && low.replace(/[^a-z0-9]/g, '').includes(host)))) break;
    if (m.index < 6) break;
    t = t.slice(0, m.index).trim();
  }
  return t.replace(/\s*[（(](转载|转|原创)[)）]\s*$/, '').trim();
}

const BJ = 8 * 3600000;
const endOfDay = (y, m, d) => { const t = Date.UTC(y, m - 1, d, 23, 59, 59) - BJ; return Number.isFinite(t) && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? t : null; };
/** 从文字里找截止时间：截止 2026-11-30 / 11月30日前 / 限时 3 天 / until 2026-11-30。找不到返回 null */
export function extractDeadline(text, publishedAt, now = Date.now()) {
  const s = String(text || '').slice(0, 1500);
  if (!s) return null;
  const base = publishedAt || now;
  const baseYear = new Date(base + BJ).getUTCFullYear();
  const cands = [];
  const KW = '(?:截止|截至|结束|到期|有效期至|有效期到|活动时间|领取时间|限时|until|ends?|end date|expires?|deadline|before)';
  let m;
  // 活动时间：A 至 B（取 B），先处理并从文字里去掉，避免把开始日期当成截止
  const range = /(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?[^\n]{0,20}?(?:至|到|~|～|—)\s*(?:(20\d{2})[-/.年])?(\d{1,2})[-/.月](\d{1,2})日?/g;
  let rest = s;
  while ((m = range.exec(s))) { cands.push(endOfDay(Number(m[4] || m[1]), Number(m[5]), Number(m[6]))); rest = rest.replace(m[0], ' '); }
  // 带年份的完整日期，前面 30 字以内有截止类字样，或日期后紧跟「截止 / 前 / 结束」
  const full = new RegExp(KW + '[^\\n]{0,30}?(20\\d{2})[-/.年](\\d{1,2})[-/.月](\\d{1,2})|(20\\d{2})[-/.年](\\d{1,2})[-/.月](\\d{1,2})日?\\s*(?:\\d{1,2}:\\d{2}(?::\\d{2})?)?\\s*(?:前|之前|截止|结束|到期|止)', 'gi');
  while ((m = full.exec(rest))) cands.push(endOfDay(Number(m[1] || m[4]), Number(m[2] || m[5]), Number(m[3] || m[6])));
  // 没有年份：截止 11月30日 / 11月30日前
  const md = new RegExp(KW + '[^\\n\\d]{0,12}(\\d{1,2})月(\\d{1,2})[日号]|(\\d{1,2})月(\\d{1,2})[日号]\\s*(?:\\d{1,2}[:点]\\d{0,2})?\\s*(?:前|之前|截止|结束|到期|止)', 'g');
  while ((m = md.exec(rest))) {
    const mo = Number(m[1] || m[3]), d = Number(m[2] || m[4]);
    let t = endOfDay(baseYear, mo, d);
    if (t && t < base - 30 * 86400000) t = endOfDay(baseYear + 1, mo, d);
    cands.push(t);
  }
  // 限时 N 天 / 仅剩 N 天
  const nd = /(?:限时|仅剩|只剩|还剩|剩余)\s*(\d{1,2})\s*天/.exec(rest);
  if (nd) cands.push(base + Number(nd[1]) * 86400000);
  const ok = cands.filter((t) => t && t > base - 86400000 && t < now + 400 * 86400000);
  return ok.length ? Math.min(...ok) : null;
}

/** 正文里的兑换码 / 激活码（最多 5 个）。只认「码：XXXX」这种明确写出来的 */
export function extractCodes(text) {
  const s = String(text || '').slice(0, 2000);
  const out = [];
  const re = /(?:兑换码|激活码|注册码|优惠码|折扣码|序列号|口令|礼包码|(?<![a-z])(?:cdkey|cd-key|promo code|coupon code|redeem code|license key|serial|code)(?![a-z]))\s*[:：为是]?\s*[「“"'`(（]?\s*([A-Z0-9][A-Z0-9-]{4,38}[A-Z0-9])/gi;
  let m;
  while ((m = re.exec(s)) && out.length < 5) {
    const c = m[1];
    // 至少有一个数字，或者是 XXXX-XXXX 这种分段格式；排除纯英文单词和网址片段
    if (!/\d/.test(c) && !/^[A-Z0-9]{3,}(-[A-Z0-9]{3,}){2,}$/i.test(c)) continue;
    if (/^(http|www|20\d{2}-\d)/i.test(c) || /^\d{1,6}$/.test(c) || (/[a-z]/.test(c) && /[A-Z]/.test(c) && c.length < 10)) continue;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/** 一句话摘要：取第一句（不超过 n 字） */
export function firstSentence(text, n = 90) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const m = /^(.{12,}?[。！？!?；;])/.exec(t.slice(0, n + 40));
  const s = m && m[1].length <= n ? m[1] : t.slice(0, n);
  return s.length < t.length && !/[。！？!?；;]$/.test(s) ? s.replace(/[，,、\s]+$/, '') + '…' : s;
}

/** 签到类资源：每天签到领额度 / 积分 */
export const CHECKIN_RE = /签到|每日领取|每天领取|每日登录|daily\s*check-?in|每日额度/i;
