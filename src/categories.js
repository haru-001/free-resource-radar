// 资源分类（参考 ZiChuanLan/freebie-radar 的领域划分，MIT License，按“白嫖资源”场景精简）
// key 固定不变；label 用于界面；color 为界面上的分类色点；kw 用于关键词预筛和无 AI 时的归类；q 为联网搜索默认词。
export const CATEGORIES = [
  { key: 'domain', label: '免费域名', color: '#4f46e5', kw: ['域名', '二级域名', '子域名', 'domain', 'subdomain', 'dns', '.eu.org', '.us.kg'], q: ['免费域名 注册', '免费二级域名'] },
  { key: 'hosting', label: '主机 / VPS', color: '#0891b2', kw: ['主机', '虚拟主机', '空间', 'vps', '服务器', '建站', 'hosting', 'webhost', 'web host', 'cpanel', 'server', '小鸡'], q: ['免费虚拟主机', '免费 VPS 服务器'] },
  { key: 'cloud', label: '云服务 / CDN', color: '#0284c7', kw: ['云服务', '云函数', 'serverless', 'cdn', '对象存储', 's3', '数据库', 'database', 'cloud', 'pages', 'workers', '托管', 'deploy', 'paas'], q: ['免费云服务 额度', '免费 CDN 对象存储'] },
  { key: 'ai', label: 'AI 免费额度', group: 'aifree', color: '#7c3aed', kw: ['ai', 'gpt', 'claude', 'gemini', 'llm', '大模型', 'api key', 'token', '额度', '模型', 'openrouter', 'deepseek', 'copilot', 'cursor', '免费模型', '免费层', 'free tier'], q: ['免费 AI API 额度', '大模型 免费 token'] },
  // AI 限时福利：限时免费开放、注册送额度、优惠码 / 免费月、公益站签到，时效强，单独成类
  { key: 'aideal', label: 'AI 限时福利', group: 'aifree', color: '#c026d3', need: /(^|[^a-z])(ai|api|gpt|llm|agent|token)([^a-z]|$)|claude|gemini|deepseek|qwen|kimi|glm|grok|openai|anthropic|cursor|copilot|大模型|模型|智能体|算力|生图|编程助手/i, kw: ['限时免费', '免费开放', '送额度', '注册送', '赠金', '赠送', '免费领', '免费一个月', '免费试用', '优惠码', '兑换码', '公益站', '中转站', 'new api', '签到', '福利', 'free credits', 'free month'], q: ['AI 限时免费 送额度', 'AI 公益站 注册送额度'] },
  { key: 'aitool', label: 'AI 工具', group: 'ai', color: '#a21caf', kw: ['ai 工具', 'ai工具', 'agent', '智能体', 'ai 绘画', 'ai绘图', '生图', 'ai 写作', 'chatgpt 镜像', '镜像站', 'mcp', 'ai 助手', 'ai助手', '插件'], q: ['免费 AI 工具 推荐'] },
  { key: 'software', label: '软件授权', color: '#db2777', kw: ['激活码', '授权', '注册码', '许可证', 'license', 'giveaway', '限免', '正版', 'pro 版', '会员版', 'lifetime'], q: ['正版软件 限免', '软件 激活码 免费领取'] },
  { key: 'dev', label: '开发工具', color: '#475569', kw: ['开发者', 'developer', 'ide', 'github', 'api', 'sdk', 'ci', '监控', '邮箱服务', 'smtp', 'free tier', 'free plan'], q: ['开发者 免费套餐', 'free tier for developers'] },
  { key: 'game', label: '游戏', color: '#16a34a', kw: ['游戏', 'steam', 'epic', 'gog', 'game', '喜加一', 'dlc'], q: ['喜加一 免费领取'] },
  { key: 'media', label: '影音会员', color: '#e11d48', kw: ['会员', '视频', '音乐', '影视', 'vip', 'spotify', 'youtube', 'netflix', '电子书', 'kindle'], q: ['免费会员 领取'] },
  { key: 'design', label: '设计素材', color: '#ea580c', kw: ['字体', '素材', '图标', '模板', 'font', 'icon', 'template', 'figma', 'psd'], q: ['免费商用 字体 素材'] },
  { key: 'edu', label: '学生 / 教育', color: '#ca8a04', kw: ['学生', '教育', 'edu', 'student', '学术', '校园'], q: ['学生 免费 权益'] },
  { key: 'course', label: '网课教程', color: '#65a30d', kw: ['课程', '网课', '教程', 'course', 'udemy', 'coursera', '训练营'], q: ['限时免费 课程'] },
  { key: 'pan', label: '网盘资源', color: '#0d9488', kw: ['网盘', '云盘', '阿里云盘', '百度网盘', '夸克', '分享链接', '资源合集'], q: [] },
  { key: 'goods', label: '实物福利', color: '#dc2626', kw: ['包邮', '实物', '周边', '0元购', '免费送', '赠送', '贴纸', 'swag'], q: [] },
  { key: 'invite', label: '邀请码', color: '#9333ea', kw: ['邀请码', '邀请链接', 'invite', '内测资格', 'beta'], q: [] },
  // 资讯类：不是“白嫖资源”，不要求出现“免费”字样，一般由专源直接收录
  { key: 'ainews', label: 'AI 资讯', group: 'ai', info: true, color: '#6d28d9', kw: ['发布', '上线', '开源', '大模型', '模型', 'openai', 'anthropic', 'gemini', 'deepseek', '智能体'], q: [] },
  { key: 'news', label: '科技资讯', group: 'news', info: true, color: '#2563eb', kw: ['发布', '宣布', '消息', '报道', '财报', '新品', '更新'], q: [] },
  { key: 'other', label: '其它', color: '#9ca3af', kw: [], q: [] },
];
for (const c of CATEGORIES) c.group ||= 'fuli';
export const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
// 栏目：分类按用途分成四组，前台按栏目切换，后台按栏目整组勾选
export const GROUPS = [
  { key: 'fuli', label: '福利羊毛', icon: '羊' },
  { key: 'aifree', label: 'AI 福利', icon: '惠' },
  { key: 'ai', label: 'AI 工具与资讯', icon: 'AI' },
  { key: 'news', label: '新闻资讯', icon: '讯' },
];
export const isInfoCat = (k) => !!CAT_MAP[k]?.info;
export const catLabel = (k) => CAT_MAP[k]?.label || '其它';
export const DEFAULT_ENABLED = ['domain', 'hosting', 'cloud', 'ai', 'aideal', 'aitool', 'software', 'dev', 'game', 'edu', 'ainews', 'news'];

export function enabledCats(s) {
  const list = String(s.enabled_categories || '').split(/[,\s]+/).filter((k) => CAT_MAP[k]);
  return list.length ? list : DEFAULT_ENABLED;
}
export function mailCats(s) {
  const list = String(s.mail_categories || '').split(/[,\s]+/).filter((k) => CAT_MAP[k]);
  return list.length ? list : enabledCats(s);
}
// 短英文词（ai、api、ci、s3…）按单词边界匹配，避免 email、maintain 之类误命中
const reCache = new Map();
export function kwHit(text, w) {
  if (/^[a-z0-9.\- ]{1,4}$/.test(w)) {
    let re = reCache.get(w);
    if (!re) { re = new RegExp(`(^|[^a-z0-9])${w.replace(/[.\-]/g, '\\$&')}($|[^a-z0-9])`); reCache.set(w, re); }
    return re.test(text);
  }
  return text.includes(w);
}
/** 把一组关键词编译成一个正则（短英文词按单词边界），比逐个匹配省 CPU */
export function compileWords(words) {
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = [...new Set(words.filter(Boolean))].map((w) => (/^[a-z0-9.\- ]{1,4}$/.test(w) ? `(?:^|[^a-z0-9])${esc(w)}(?:$|[^a-z0-9])` : esc(w)));
  return parts.length ? new RegExp(parts.join('|')) : null;
}
/** 关键词归类：返回命中次数最多的已启用分类 */
export function guessCategory(text, enabled) {
  const t = String(text || '').toLowerCase();
  let best = null, bestN = 0;
  for (const k of enabled) {
    if (CAT_MAP[k]?.need && !CAT_MAP[k].need.test(t)) continue; // 比如「AI 限时福利」必须和 AI 有关
    const n = (CAT_MAP[k]?.kw || []).reduce((a, w) => a + (kwHit(t, w) ? 1 : 0), 0);
    if (n > bestN) { best = k; bestN = n; }
  }
  return best;
}
export function topicWordsFor(enabled) {
  return [...new Set(enabled.flatMap((k) => CAT_MAP[k]?.kw || []))];
}
export function searchQueriesFor(enabled) {
  return enabled.flatMap((k) => CAT_MAP[k]?.q || []);
}
