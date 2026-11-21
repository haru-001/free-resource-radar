// 规则层：噪音标题、获取方式、屏蔽规则、跨源去重指纹
// 部分规则移植并精简自 ZiChuanLan/freebie-radar（MIT License, Copyright (c) 2026 ZiChuanLan）

/** 社区求助 / 抱怨 / 水帖标题：命中直接跳过，不送 AI，省额度 */
const NOISE_TITLE =
  /^(怎样|怎么|如何|哪里|哪个|为什么|为何)|请问|有没有|求推荐|求一个|哪里(有|能)|值得买吗|怎么样[?？]|不够用|用完了|失效了|吐槽|踩坑|后悔|失望|谁有|求个|求购|哪有|多少钱|求助|求带|有人吗|有人知道|被封|封号|跑路|[?？]\s*$/;

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
export function guessObtain(title, summary = '') {
  const t = `${title} ${summary}`;
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
