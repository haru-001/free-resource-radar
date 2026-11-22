// 数据库与设置
import { PUSH_CHANNELS, PUSH_KEYS } from './push.js';
import { DEFAULT_RADAR_QUERIES, DEFAULT_RADAR_VENDORS } from './extras.js';
export const DEFAULT_SOURCES = [
  // 中文社区（部分源参考 ZiChuanLan/freebie-radar 的内置源）
  { name: 'V2EX · 免费赠送', type: 'v2ex', node: 'free', enabled: true },
  { name: 'V2EX · 云计算', type: 'v2ex', node: 'cloud', enabled: true },
  { name: 'V2EX · 推广与注册送', type: 'v2ex', node: 'promotions', enabled: true },
  { name: 'V2EX · 分享发现', type: 'v2ex', node: 'share', enabled: false },
  { name: 'NodeSeek · 福利情报', type: 'rss', url: 'https://rss.nodeseek.com/', enabled: true },
  { name: 'NodeLoc · 羊毛与主机', type: 'rss', url: 'https://www.nodeloc.com/latest.rss', enabled: true },
  // LINUX DO 有 Cloudflare 护盾，机房 IP 常被拦，默认关闭
  { name: 'LINUX DO · 福利羊毛', type: 'rss', url: 'https://linux.do/c/welfare/36.rss', enabled: false },
  { name: '小众软件论坛 · 发现', type: 'rss', url: 'https://meta.appinn.net/c/faxian/10.rss', enabled: true },
  // 白嫖专源：内容本身就是免费资源，免关键词预筛、免 AI 审核直接入库（trusted），分类固定
  { name: 'Epic · 每周免费游戏', type: 'epic', category: 'game', trusted: true, enabled: true },
  { name: 'GamerPower · 限免游戏', type: 'gamerpower', category: 'game', trusted: true, enabled: true },
  { name: 'OpenRouter · 免费模型', type: 'openrouter_free', category: 'ai', trusted: true, enabled: true },
  // include：标题需匹配的正则（这个源混有打折商品，只要 100% 免费的）
  { name: 'SharewareOnSale · 正版软件限免', type: 'rss', url: 'https://sharewareonsale.com/feed', include: '100% discount|\\bfree\\b', category: 'software', trusted: true, note: '正版软件限时 100% 免费领取（英文站）', enabled: true },
  { name: 'V2EX · 创意', type: 'v2ex', node: 'create', enabled: false },
  // 中文白嫖专源。category: 'auto' 表示按关键词自动归类（归不进已勾选的分类就跳过）
  { name: '反斗限免 · 限时免费', type: 'rss', url: 'https://free.apprcn.com/feed/', category: 'auto', fallback: 'software', trusted: true, enabled: true },
  { name: 'IT之家 · 喜加一 / 限免', type: 'rss', url: 'https://www.ithome.com/rss/', include: '喜加一|限免|限时免费|免费领|白嫖', category: 'auto', fallback: 'game', trusted: true, enabled: true },
  { name: '如有乐享 · 免费资源', type: 'rss', url: 'https://51.ruyo.net/feed', enabled: true },
  { name: '小众软件 · 主站', type: 'rss', url: 'https://www.appinn.com/feed/', enabled: true },
  { name: '异次元软件世界', type: 'rss', url: 'https://feed.iplaysoft.com/', enabled: true },
  { name: '蓝点网', type: 'rss', url: 'https://www.landian.news/feed', include: '免费|限免|白嫖|领取|赠送', enabled: true },
  // cats：这个源只收哪些分类（其它分类的内容直接丢弃）；hint：关键词归不了类时默认归到哪个分类
  // 2026-11-21 实测可用的中文源
  { name: '零度解说 · 免费软件与资源', type: 'rss', url: 'https://www.freedidi.com/feed', enabled: true },
  { name: 'A姐分享 · 免费资源', type: 'rss', url: 'https://www.ahhhhfs.com/feed/', enabled: true },
  { name: 'TG · A姐分享 @abskoop', type: 'telegram', channel: 'abskoop', enabled: true },
  { name: 'TG · 在花科技圈 @zaihuapd', type: 'telegram', channel: 'zaihuapd', include: '免费|限免|白嫖|领取|赠送|0元|喜加一', enabled: true },
  { name: '福利吧', type: 'rss', url: 'https://fuliba.net/feed', include: '免费|限免|白嫖|领取|赠送|羊毛|福利', enabled: true },
  { name: '少数派 · 限免', type: 'rss', url: 'https://sspai.com/feed', include: '限免|免费|白嫖', enabled: true },
  { name: '果核剥壳', type: 'rss', url: 'https://www.ghxi.com/feed', cats: ['software', 'dev', 'ai', 'pan'], hint: 'software', enabled: true },
  { name: '异星软件空间', type: 'rss', url: 'https://www.yxssp.com/feed', cats: ['software', 'dev', 'ai'], hint: 'software', enabled: true },
  { name: '克隆窝', type: 'rss', url: 'https://www.uy5.net/feed/', cats: ['software', 'dev', 'ai'], hint: 'software', enabled: true },
  { name: '翻应用 · iOS 限免', type: 'rss', url: 'https://www.iapps.me/feed', cats: ['software', 'game'], hint: 'software', enabled: true },
  { name: 'FreeGroup · 免费资源', type: 'rss', url: 'https://free.com.tw/feed/', enabled: true },
  { name: '其乐 Keylol · 游戏', type: 'rss', url: 'https://keylol.com/forum.php?mod=rss', include: '免费|限免|喜加一|白嫖|领取|赠送|giveaway', cats: ['game'], hint: 'game', enabled: true },
  { name: 'VPS精选网', type: 'rss', url: 'https://www.vpsjxw.com/feed/', cats: ['hosting', 'domain', 'cloud'], hint: 'hosting', enabled: true },
  { name: '老左笔记', type: 'rss', url: 'https://www.laozuo.org/feed/', cats: ['hosting', 'domain', 'cloud'], hint: 'hosting', enabled: true },
  { name: '主机百科', type: 'rss', url: 'https://zhujiwiki.com/feed/', cats: ['hosting', 'domain', 'cloud'], hint: 'hosting', enabled: true },
  { name: 'VPS 侦探', type: 'rss', url: 'https://www.vpser.net/feed', cats: ['hosting', 'domain', 'cloud'], hint: 'hosting', enabled: true },
  { name: 'VEIDC', type: 'rss', url: 'https://www.veidc.com/feed', cats: ['hosting', 'domain', 'cloud'], hint: 'hosting', enabled: true },
  { name: 'VPSGO', type: 'rss', url: 'https://www.vpsgo.com/feed', cats: ['hosting', 'domain', 'cloud'], hint: 'hosting', enabled: true },
  { name: 'xiaoz 博客', type: 'rss', url: 'https://blog.xiaoz.org/feed', cats: ['hosting', 'domain', 'cloud', 'dev', 'software'], enabled: true },
  { name: 'TG · 网盘资源（迅雷云盘）@yunpanxunlei', type: 'telegram', channel: 'yunpanxunlei', category: 'pan', trusted: true, enabled: false },
  // ---------- AI 专区（2026-11-22 实测可抓） ----------
  // Ailyre AI 速递（ailyre.com/news）：「福利速递」轨道是厂商福利（限时免费开放、优惠码、送额度），其余是模型上新和服务变动
  { name: 'Ailyre · AI 福利速递', type: 'rss', url: 'https://www.ailyre.com/news/rss.xml', tags: ['福利速递'], cats: ['ai', 'aideal'], hint: 'aideal', every: 3, enabled: true },
  { name: 'Ailyre · AI 速递（模型与服务变动）', type: 'rss', url: 'https://www.ailyre.com/news/rss.xml', skip_tags: ['福利速递'], category: 'ainews', trusted: true, limit: 10, every: 6, enabled: true },
  { name: '赛博鸡蛋 · AI 免费额度', type: 'rss', url: 'https://jidan.si/rss.xml', cats: ['ai', 'aideal', 'aitool'], hint: 'ai', enabled: true },
  { name: 'AI 福利雷达', type: 'rss', url: 'https://aifuli.dev/rss.xml', cats: ['ai', 'aideal', 'aitool'], hint: 'aideal', enabled: true },
  { name: 'free-llm-intel · 免费额度变化', type: 'rss', url: 'https://free-llm-intel.aishort.top/feeds/llm-intel-changes.xml', category: 'ai', trusted: true, limit: 15, enabled: true },
  { name: 'TG · LINUX DO 福利 @linuxdo_tg', type: 'telegram', channel: 'linuxdo_tg', include: '福利羊毛|公益站|公益推广|白嫖|免费|额度|赠送|送\\s*\\$?\\d', cats: ['ai', 'aideal', 'aitool', 'cloud', 'dev'], hint: 'aideal', enabled: true },
  { name: 'TG · 苹果科技 @pgkj666', type: 'telegram', channel: 'pgkj666', include: 'API|额度|Token|免费|公益|中转', cats: ['ai', 'aideal', 'aitool'], hint: 'aideal', enabled: true },
  // GitHub 同类清单：仓库一有新提交，就把新增的条目同步过来（读 commits.atom + 提交的 .patch，不走 GitHub API，不需要 Token）
  { name: 'GitHub · 免费 AI API 中转站导航', type: 'repo', repo: 'kirito8/free-newapi', mode: 'diff', include: '公益|免费|签到|注册送|赠送|送\\s*[$¥]?\\d|白嫖|额度', category: 'aideal', trusted: true, every: 12, enabled: true },
  { name: 'GitHub · AI API 公益站导航', type: 'repo', repo: 'bubblevv/ai-api-gongyi-nav', mode: 'diff', path: 'README\\.md$', include: '公益|免费|签到|注册送|赠送|送\\s*[$¥]?\\d|白嫖|额度', category: 'aideal', trusted: true, every: 12, enabled: true },
  { name: 'GitHub · 免费 AI Token 清单（中国区）', type: 'repo', repo: 'KJAI123/awesome-free-ai-tokens-cn', mode: 'diff', category: 'ai', trusted: true, every: 12, enabled: true },
  { name: 'GitHub · 免费大模型 API 导航', type: 'repo', repo: 'peter123023/awesome-free-llm-api', mode: 'diff', path: 'README\\.md$', category: 'ai', trusted: true, every: 12, enabled: true },
  { name: 'GitHub · FreeToken 免费额度大全', type: 'repo', repo: 'AIPMAndy/FreeToken', mode: 'diff', path: 'README', category: 'ai', trusted: true, every: 12, enabled: true },
  { name: 'GitHub · 免费 LLM API 平台汇总', type: 'repo', repo: 'CYBIRD-D/FREE-LLM-API-Provider', mode: 'diff', path: 'README\\.zh-CN\\.md$', category: 'ai', trusted: true, every: 12, enabled: true },
  { name: 'GitHub · 中国独立开发者项目', type: 'repo', repo: '1c7/chinese-independent-developer', mode: 'diff', path: '^README\\.md$', cats: ['aitool', 'software', 'dev'], hint: 'software', category: 'auto', fallback: 'software', trusted: true, every: 12, enabled: false },
  { name: 'GitHub · free-for-dev（英文）', type: 'repo', repo: 'ripienaar/free-for-dev', mode: 'diff', cats: ['dev', 'cloud', 'hosting', 'ai'], hint: 'dev', every: 12, enabled: false },
  // ---------- 新闻资讯：资讯类专源直接收录，每次每个源最多取 limit 条 ----------
  { name: 'free-llm-intel · AI 厂商动态', type: 'rss', url: 'https://free-llm-intel.aishort.top/feeds/llm-news-all.xml', category: 'ainews', trusted: true, limit: 12, every: 6, enabled: true },
  { name: '量子位', type: 'rss', url: 'https://www.qbitai.com/feed', category: 'ainews', trusted: true, limit: 10, every: 6, enabled: true },
  { name: 'Solidot', type: 'rss', url: 'https://www.solidot.org/index.rss', category: 'news', trusted: true, limit: 10, every: 6, enabled: true },
  { name: '爱范儿', type: 'rss', url: 'https://www.ifanr.com/feed', category: 'news', trusted: true, limit: 10, every: 6, enabled: true },
  { name: 'cnBeta', type: 'rss', url: 'https://www.cnbeta.com.tw/backend.php', category: 'news', trusted: true, limit: 10, every: 6, enabled: true },
  { name: '极客公园', type: 'rss', url: 'https://www.geekpark.net/rss', category: 'news', trusted: true, limit: 8, every: 6, enabled: true },
  { name: '阮一峰 · 科技爱好者周刊', type: 'rss', url: 'https://www.ruanyifeng.com/blog/atom.xml', category: 'news', trusted: true, limit: 3, every: 6, enabled: true },
  // ---------- 免费梯子：GitHub 上自动更新的公共节点订阅，每个仓库只占一条，有新提交就刷新时间 ----------
  { name: 'Pawdroid / Free-servers', type: 'repo', repo: 'Pawdroid/Free-servers', mode: 'sub', category: 'proxy', trusted: true, subs: [['通用订阅', 'https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub']], every: 12, enabled: true },
  { name: 'ermaozi / get_subscribe', type: 'repo', repo: 'ermaozi/get_subscribe', mode: 'sub', category: 'proxy', trusted: true, subs: [['V2Ray', 'https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/v2ray.txt'], ['Clash', 'https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/clash.yml']], every: 12, enabled: true },
  { name: 'chengaopan / AutoMergePublicNodes', type: 'repo', repo: 'chengaopan/AutoMergePublicNodes', mode: 'sub', category: 'proxy', trusted: true, subs: [['V2Ray', 'https://raw.githubusercontent.com/chengaopan/AutoMergePublicNodes/master/list.txt'], ['Clash', 'https://raw.githubusercontent.com/chengaopan/AutoMergePublicNodes/master/list.yml']], every: 12, enabled: true },
  { name: 'peasoft / NoMoreWalls', type: 'repo', repo: 'peasoft/NoMoreWalls', mode: 'sub', category: 'proxy', trusted: true, subs: [['V2Ray', 'https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list.txt'], ['Clash', 'https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list.yml']], every: 12, enabled: true },
  { name: 'mahdibland / V2RayAggregator', type: 'repo', repo: 'mahdibland/V2RayAggregator', mode: 'sub', category: 'proxy', trusted: true, subs: [['V2Ray', 'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt'], ['Clash', 'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/Eternity.yml']], every: 12, enabled: true },
  { name: 'snakem982 / proxypool', type: 'repo', repo: 'snakem982/proxypool', mode: 'sub', category: 'proxy', trusted: true, subs: [['V2Ray', 'https://raw.githubusercontent.com/snakem982/proxypool/main/source/v2ray-2.txt'], ['Clash Meta', 'https://raw.githubusercontent.com/snakem982/proxypool/main/source/clash-meta-2.yaml']], every: 12, enabled: true },
  { name: 'Barabama / FreeNodes', type: 'repo', repo: 'Barabama/FreeNodes', mode: 'sub', category: 'proxy', trusted: true, subs: [['V2Ray', 'https://raw.githubusercontent.com/Barabama/FreeNodes/main/nodes/clashmeta.txt'], ['Clash Meta', 'https://raw.githubusercontent.com/Barabama/FreeNodes/main/nodes/clashmeta.yaml']], every: 12, enabled: true },
  { name: 'free18 / v2ray', type: 'repo', repo: 'free18/v2ray', mode: 'sub', category: 'proxy', trusted: true, subs: [['V2Ray', 'https://raw.githubusercontent.com/free18/v2ray/main/v.txt'], ['Clash', 'https://raw.githubusercontent.com/free18/v2ray/main/c.yaml']], every: 12, enabled: true },
  // 英文社区：默认过滤纯英文内容，这些源默认关闭；关掉「过滤纯英文」后可按需打开
  { name: 'LowEndTalk · Offers', type: 'rss', url: 'https://lowendtalk.com/categories/offers/feed.rss', enabled: false },
  { name: 'LowEndSpirit', type: 'rss', url: 'https://lowendspirit.com/discussions/feed.rss', enabled: false },
  { name: 'Hacker News · free domain', type: 'hn', query: '"free domain"', enabled: false },
  { name: 'Hacker News · free subdomain', type: 'hn', query: '"free subdomain"', enabled: false },
  { name: 'Hacker News · free hosting', type: 'hn', query: '"free hosting"', enabled: false },
  // GitHub 仓库搜索噪音大，建议配合 AI 判定再开启
  { name: 'GitHub · free domain', type: 'github', query: 'free domain', ai_only: true, enabled: false },
  { name: 'GitHub · free hosting', type: 'github', query: 'free hosting', ai_only: true, enabled: false },
  // ai_only：讨论帖多，只有配置了 AI 判定时才抓
  { name: 'Hacker News · free tier', type: 'hn', query: '"free tier"', ai_only: true, enabled: false },
  { name: 'Hacker News · free credits', type: 'hn', query: '"free credits"', ai_only: true, enabled: false },
  // Reddit 常拦截机房 IP，默认关闭
  { name: 'Reddit · free domain', type: 'reddit', query: 'free domain', enabled: false },
  { name: 'Reddit · free web hosting', type: 'reddit', query: 'free web hosting', enabled: false },
];

export const DEFAULT_SETTINGS = {
  // AI 判定（OpenAI 兼容接口）
  ai_enabled: 'true',     // 可选：填好接口地址、Key、模型就自动使用；不填则用关键词判定
  ai_base_url: 'https://api.openai.com/v1',
  ai_api_key: '',
  ai_model: '',
  ai_batch_size: '12',    // 每次请求判定几条
  ai_max_items: '60',     // 每次运行最多送 AI 判定几条（免费版 Worker 每次最多 50 个外部请求，别设太大）
  ai_min_score: '60',
  ai_review: 'smart',     // smart：把握大的自动通过 / 拒绝，只把拿不准的交给 AI；all：全部交给 AI
  fresh_days: '15',       // 发布超过这么多天的条目，前台和邮件里单独归到「较早发布」
  ai_cache: 'true',       // 同一个目标地址判过一次就复用结论，不重复花 AI 额度
  // 联网搜索后端（见 search.js 的 BACKENDS）。全部默认开启：AnySearch、Keenable 免 Key 直接可用；其余填了 Key 就自动参与，没填就跳过
  anysearch_enabled: 'true',
  anysearch_api_key: '',    // 可选；填了就固定走 Key
  keenable_enabled: 'true',
  keenable_api_key: '',     // 可选；留空走免 Key 公共接口（按 IP 限流）
  keenable_mode: 'pro',     // pro / realtime
  tavily_enabled: 'true',
  tavily_api_key: '',
  tavily_depth: 'basic',    // basic / advanced / fast
  exa_enabled: 'true',
  exa_api_key: '',
  brave_enabled: 'true',
  brave_api_key: '',
  qianfan_enabled: 'true',
  qianfan_api_key: '',
  volc_enabled: 'true',
  volc_api_key: '',
  // 每个搜索后端负责哪些分类（逗号分隔的分类 key，留空 = 全部已勾选分类）：只用这些分类生成搜索词，结果也只收这些分类
  anysearch_cats: '', keenable_cats: '', tavily_cats: '', exa_cats: '', brave_cats: '', qianfan_cats: '', volc_cats: '',
  // 后台「更新源」从这些地址拉取数据源（每行一个）：freebie-radar 的 SEEDS（.ts）或本项目格式的 JSON 数组
  source_sync_urls: 'https://raw.githubusercontent.com/ZiChuanLan/freebie-radar/main/src/server/collectors/index.ts',
  search_max_results: '10', // 每个查询返回条数
  search_queries: '',     // 留空：按勾选的分类自动生成中文搜索词；填写则只用你写的
  search_max_queries: '6',  // 每次最多查几个词（省额度，也避免超出 Worker 外部请求上限）
  search_lang: 'zh_only',  // zh_first 中文优先 / zh_only 只要中文 / any 不限
  search_block_domains: ['csdn.net', 'baijiahao.baidu.com', 'sohu.com', '163.com', 'toutiao.com'].join('\n'), // 屏蔽的站点（转载 / 搬运居多）
  // 邮件日报
  mail_enabled: 'true',      // 填好账号和收件人后自动生效；未填写时跳过
  mail_provider: 'smtp',     // smtp / resend / brevo / cloudflare
  smtp_host: 'smtp.qq.com',  // QQ 邮箱默认配置
  smtp_port: '465',
  smtp_secure: 'ssl',        // ssl（465）/ starttls（587）
  smtp_user: '',             // 完整 QQ 邮箱，如 123456@qq.com
  smtp_pass: '',             // QQ 邮箱授权码（不是 QQ 密码），存 KV
  mail_api_key: '',          // Resend / Brevo 的 Key，存 KV
  mail_from: '',             // 发件地址；SMTP 留空则使用 smtp_user（QQ 要求一致）
  mail_from_name: '免费资源雷达',
  mail_to: '',               // 收件人，多个用逗号分隔（最多 10 个）
  mail_separate: 'true',     // 每个收件人单独发一封，互相看不到地址
  mail_subject: '免费资源雷达 · 今日白嫖',
  mail_only_new: 'true',     // 只发上次之后新通过的
  mail_send_empty: 'false',  // 没有新内容也发
  mail_max_items: '60',
  mail_site_url: '',         // 邮件底部“查看全部”链接，如 https://xxx.workers.dev
  mail_last_sent_at: '0',    // 内部使用
  // Telegram 推送（与邮件共用“上次推送时间”）
  telegram_enabled: 'false',
  telegram_bot_token: '',    // 存 KV
  telegram_chat_id: '',      // 存 KV
  // Webhook 类推送（地址 / Key 存 KV），填了就推；{id}_enabled 可单独关掉
  ...Object.fromEntries(PUSH_CHANNELS.flatMap((c) => [[c.key, ''], [`${c.id}_enabled`, 'true'], ...(c.secret ? [[c.secret, '']] : [])])),
  // 抓取与过滤
  noise_filter: 'true',
  filter_english: 'true',    // 过滤纯英文内容（标题和正文都没有中文就丢弃）      // 跳过求助 / 吐槽类标题，不送 AI
  allowed_obtain: 'free,conditional', // 允许的获取方式：free 直接白嫖 / conditional 有条件 / trial / lottery / promo / paid
  block_rules: ['# 每行一条，普通文本为关键词，/正则/i 为正则；命中即丢弃，不送 AI', '已失效', '/已(关闭|停止)注册/'].join('\n'),
  max_age_days: '180',    // 超过半年的消息过滤掉
  retention_days: '15',
  run_hour: '9',          // 每天第一次抓取的时间（北京时间，0-23）
  crawl_every_hours: '6', // 每隔几小时抓一次（从 run_hour 起算；24 = 每天一次）
  mail_hours: '9,21',     // 每天几点推送（北京时间，逗号分隔；若刚好在抓取，抓完再推）
  steps_per_tick: '1',    // 每次定时调用执行几步；免费版保持 1（10ms CPU 限制），付费版可调大   // 抓到的数据按日期存储，保留 15 天后自动清理
  keep_undated: 'false',  // 无发布日期的条目是否保留
  // 访问触发与缓存
  trigger_min_seconds: '30', // 触发地址 / 访问触发的最小间隔（秒），间隔内的请求直接返回不执行
  visit_trigger: 'false',    // 有人打开资源页时顺带推进一步抓取（定时任务的备用方案）
  public_cache_seconds: '60', // 资源页数据缓存秒数，缓存期内不查数据库
  // AI 福利雷达：用已开启的搜索后端按福利词 + 厂商轮流搜，结果只收「AI 免费额度 / AI 限时福利」，再经判定整理
  aifree_radar: 'true',
  aifree_queries: DEFAULT_RADAR_QUERIES.join('\n'),
  aifree_vendors: DEFAULT_RADAR_VENDORS.join('\n'),
  aifree_vendors_per_run: '3', // 每轮轮到几个厂商
  aifree_days: '30',           // 只要最近多少天的
  // v1.8 板块与功能
  search_strict: 'true',   // 搜索结果标题里必须有免费类字样（搜索来的条目质量参差，从严）
  watch_enabled: 'true',   // 关键词提醒：命中就单独推送，不等日报
  watch_keywords: '',      // 每行一个关键词，如 Claude / 域名 / VPS
  link_check: 'true',      // 失效检测：每次抓取后抽查一批链接，打不开或写着已结束的标灰下沉
  link_check_per_run: '8',
  weekly_enabled: 'false', // 每周精选：每周一（可改）随推送附带本周最值的 10 条
  weekly_weekday: '1',     // 0 = 周日，1 = 周一 …
  vote_hide: '3',          // 「不值」比「值」多这么多票就自动隐藏（0 = 不隐藏）
  checkin_sites: '',       // 签到清单，每行：名称 | 地址 | 备注
  perks_extra: '',         // 学生 / 开发者专区追加，每行：名称 | 地址 | 说明 | 学生 或 开发者
  login_max_fails: '10',   // 同一 IP 15 分钟内登录失败这么多次就暂时锁定
  api_rate_per_min: '120', // 公开接口每个 IP 每分钟最多请求数（0 = 不限）
  // 分类：勾选要收集的；推送分类留空 = 与收集相同
  enabled_categories: 'domain,hosting,cloud,ai,aideal,aitool,software,dev,game,edu,ainews,news,proxy',
  mail_categories: '',
  simple_signup_only: 'true', // 只要注册简单的（邮箱 / GitHub / Google 登录）
  topic_keywords: '',      // 额外主题词（每个分类已内置关键词，这里只需补充）
  free_keywords: ['免费', '白嫖', '0元', '零元', '永久免费', '限免', '限时免费', '喜加一', '送', '领取', 'free', 'gratis', '$0', 'giveaway', '100% off'].join('\n'),
  hard_signup_keywords: ['信用卡', '银行卡', '绑卡', '实名', '身份证', 'kyc', '手机验证', '短信验证', '邀请码', 'credit card', 'debit card', 'phone verification', 'sms verification', 'id verification', 'passport', 'invite code'].join('\n'),
  sources: JSON.stringify(DEFAULT_SOURCES, null, 2),
};

const SEARCH_KEYS = ['anysearch_api_key', 'keenable_api_key', 'tavily_api_key', 'exa_api_key', 'brave_api_key', 'qianfan_api_key', 'volc_api_key'];
export const SECRET_KEYS = ['ai_api_key', 'mail_api_key', 'smtp_pass', 'telegram_bot_token', ...SEARCH_KEYS, ...PUSH_KEYS];
// 敏感配置：绑定了 KV（SECRETS）就存 KV，否则存 D1 的 secrets 表（不和普通设置混在一起）
export const KV_KEYS = ['ai_base_url', 'ai_api_key', 'mail_api_key', 'smtp_user', 'smtp_pass', 'telegram_bot_token', 'telegram_chat_id', ...SEARCH_KEYS, ...PUSH_KEYS];
const kvName = (k) => `cfg:${k}`;

let schemaReady = false;
const SCHEMA_VER = '1.8.1';
export async function ensureSchema(env) {
  if (schemaReady) return;
  // 已经是当前版本就跳过建表（冷启动只查一次）
  const cur = await env.DB.prepare("SELECT value FROM secrets WHERE key = 'meta:schema'").first().catch(() => null);
  if (cur?.value === SCHEMA_VER) { schemaReady = true; return; }
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, source TEXT, raw_text TEXT, published_at INTEGER, fetched_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', category TEXT, name TEXT, summary TEXT, signup TEXT, score INTEGER, judged_by TEXT, judged_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_items_status ON items(status, published_at)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS runs (id INTEGER PRIMARY KEY AUTOINCREMENT, trigger TEXT, started_at INTEGER, finished_at INTEGER, stats TEXT, log TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS secrets (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
    // 一次抓取拆成的步骤（每个数据源 / 判定批次 / 推送各一步），定时任务每分钟执行一步
    env.DB.prepare("CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, seq INTEGER NOT NULL, kind TEXT NOT NULL, payload TEXT, status TEXT NOT NULL DEFAULT 'pending', claimed_at INTEGER, tries INTEGER NOT NULL DEFAULT 0)"),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_jobs_run ON jobs(run_id, status, seq)'),
    // 去重记忆：条目 15 天后会清理，但“见过”的记录保留更久，避免旧帖被重新抓取、重复推送
    env.DB.prepare('CREATE TABLE IF NOT EXISTS seen (id TEXT PRIMARY KEY, fp TEXT, seen_at INTEGER NOT NULL)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_seen_fp ON seen(fp)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_seen_at ON seen(seen_at)'),
    // v1.8：投票、来源健康、AI 结论缓存、登录失败计数
    env.DB.prepare('CREATE TABLE IF NOT EXISTS votes (id TEXT NOT NULL, voter TEXT NOT NULL, v INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (id, voter))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS src_health (name TEXT NOT NULL, day TEXT NOT NULL, fetched INTEGER NOT NULL DEFAULT 0, added INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0, last_at INTEGER, last_err TEXT, PRIMARY KEY (name, day))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS verdicts (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS rate (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset INTEGER NOT NULL)'),
    // v1.8.1：资源页快照（分块预先生成，访问时直接读）
    env.DB.prepare('CREATE TABLE IF NOT EXISTS snap (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL)'),
  ]);
  // 增量迁移：只补缺的列（先查表结构，免得每次冷启动都跑一串 ALTER，D1 免费版每次调用有查询次数限制）
  const cols = new Set(((await env.DB.prepare('PRAGMA table_info(items)').all()).results || []).map((r) => r.name));
  const add = [['obtain', 'TEXT'], ['fp', 'TEXT'], ['day', 'TEXT'], ['cats', 'TEXT'], ['hint', 'TEXT'], ['target', 'TEXT'], ['sources', 'TEXT'], ['extra', 'TEXT'], ['expires_at', 'INTEGER'], ['up', 'INTEGER NOT NULL DEFAULT 0'], ['down', 'INTEGER NOT NULL DEFAULT 0'], ['dead', 'INTEGER NOT NULL DEFAULT 0'], ['checked_at', 'INTEGER']].filter(([c]) => !cols.has(c));
  for (const [c, t] of add) { try { await env.DB.prepare(`ALTER TABLE items ADD COLUMN ${c} ${t}`).run(); } catch {} }
  const jcols = new Set(((await env.DB.prepare('PRAGMA table_info(jobs)').all()).results || []).map((r) => r.name));
  if (!jcols.has('claimed_at')) { try { await env.DB.prepare('ALTER TABLE jobs ADD COLUMN claimed_at INTEGER').run(); } catch {} }
  if (!jcols.has('tries')) { try { await env.DB.prepare('ALTER TABLE jobs ADD COLUMN tries INTEGER NOT NULL DEFAULT 0').run(); } catch {} }
  if (add.length) {
    await env.DB.batch([
      'CREATE INDEX IF NOT EXISTS idx_items_target ON items(target)',
      'CREATE INDEX IF NOT EXISTS idx_items_fp ON items(fp)',
      'CREATE INDEX IF NOT EXISTS idx_items_day ON items(day, status)',
      'CREATE INDEX IF NOT EXISTS idx_items_fetched ON items(fetched_at)',
      'CREATE INDEX IF NOT EXISTS idx_items_expires ON items(expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_health_name ON src_health(name, last_at)',
    ].map((q) => env.DB.prepare(q))).catch(() => {});
  }
  await env.DB.prepare("INSERT INTO secrets (key, value) VALUES ('meta:schema', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(SCHEMA_VER).run();
  schemaReady = true;
}

export async function getSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of results || []) if (r.key in DEFAULT_SETTINGS) s[r.key] = r.value;
  const sec = await env.DB.prepare('SELECT key, value FROM secrets').all();
  for (const r of sec.results || []) if (KV_KEYS.includes(r.key)) s[r.key] = r.value;
  if (env.SECRETS) Object.assign(s, await kvAll(env));
  return s;
}

export function maskSecret(v) {
  if (!v) return '';
  if (v.length <= 8) return '****';
  return v.slice(0, 3) + '****' + v.slice(-4);
}

// 返回给后台的设置：密钥打码
export function settingsForAdmin(s) {
  const out = { ...s };
  for (const k of SECRET_KEYS) out[k] = maskSecret(s[k]);
  return out;
}

// KV 免费版每天只有 10 万次读：所有密钥合成一个 cfg:__all 读一次（旧版逐个存的会自动合并一次）
const KV_ALL = 'cfg:__all';
let kvMemo = null;
async function kvAll(env) {
  if (kvMemo && kvMemo.exp > Date.now()) return kvMemo.v;
  let v = null;
  try { v = JSON.parse((await env.SECRETS.get(KV_ALL)) || 'null'); } catch {}
  if (!v) {
    const vals = await Promise.all(KV_KEYS.map((k) => env.SECRETS.get(kvName(k))));
    v = {};
    KV_KEYS.forEach((k, i) => { if (vals[i] !== null) v[k] = vals[i]; });
    await env.SECRETS.put(KV_ALL, JSON.stringify(v)).catch(() => {});
  }
  kvMemo = { v, exp: Date.now() + 60000 };
  return v;
}
export async function saveSettings(env, patch) {
  const stmts = [];
  const kvWrites = [];
  const kvPatch = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (!(k in DEFAULT_SETTINGS)) continue;
    let val = typeof v === 'boolean' ? String(v) : String(v ?? '');
    if (SECRET_KEYS.includes(k) && val.includes('****')) continue; // 未修改的打码密钥
    if (k === 'sources') JSON.parse(val); // 校验
    if (KV_KEYS.includes(k)) {
      stmts.push(env.DB.prepare('DELETE FROM settings WHERE key = ?').bind(k)); // 清掉旧版本存在普通设置里的值
      if (env.SECRETS) {
        kvPatch[k] = val;
        kvWrites.push(env.SECRETS.put(kvName(k), val));
        stmts.push(env.DB.prepare('DELETE FROM secrets WHERE key = ?').bind(k));
      } else {
        stmts.push(env.DB.prepare('INSERT INTO secrets (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, val));
      }
      continue;
    }
    stmts.push(
      env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, val)
    );
  }
  if (Object.keys(kvPatch).length) {
    kvMemo = null;
    const all = { ...(await kvAll(env)), ...kvPatch };
    kvWrites.push(env.SECRETS.put(KV_ALL, JSON.stringify(all)));
    kvMemo = { v: all, exp: Date.now() + 60000 };
  }
  await Promise.all(kvWrites);
  if (stmts.length) await env.DB.batch(stmts);
}

// 只读普通设置（不读 KV / 密钥），资源页等公开请求用，更快
export async function getBasicSettings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of results || []) if (r.key in DEFAULT_SETTINGS && !KV_KEYS.includes(r.key)) s[r.key] = r.value;
  return s;
}

// ---------- 内部小状态（存 secrets 表，key 以 meta: 开头） ----------
export async function getMeta(env, k) {
  const r = await env.DB.prepare('SELECT value FROM secrets WHERE key = ?').bind('meta:' + k).first();
  return r?.value ?? null;
}
export function setMeta(env, k, v) {
  return env.DB.prepare('INSERT INTO secrets (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind('meta:' + k, String(v)).run();
}
// 触发地址的密钥：首次读取时自动生成
export async function getCronKey(env, regenerate = false) {
  let k = regenerate ? null : await getMeta(env, 'cron_key');
  if (!k) {
    k = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await setMeta(env, 'cron_key', k);
  }
  return k;
}

export const lines = (txt) =>
  String(txt || '').split(/\r?\n|,/).map((x) => x.trim().toLowerCase()).filter(Boolean);

export const storageMode = (env) => (env.SECRETS && typeof env.SECRETS.get === 'function' ? 'kv' : 'd1');

// ---------- 管理员密码（未设置 ADMIN_TOKEN 时，首次打开后台设置，哈希后存 D1） ----------
export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function getAdminHash(env) {
  const r = await env.DB.prepare("SELECT value FROM secrets WHERE key = 'admin_pass_hash'").first();
  return r?.value || '';
}
export async function setAdminHash(env, password) {
  const h = await sha256('frr:' + password);
  await env.DB.prepare("INSERT INTO secrets (key, value) VALUES ('admin_pass_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(h).run();
}

// ---------- 资源页访问密码（可选，哈希存 D1） ----------
export async function getSitePassHash(env) {
  const r = await env.DB.prepare("SELECT value FROM secrets WHERE key = 'site_pass_hash'").first();
  return r?.value || '';
}
export async function setSitePass(env, password) {
  if (!password) return env.DB.prepare("DELETE FROM secrets WHERE key = 'site_pass_hash'").run();
  const h = await sha256('frr-site:' + password);
  return env.DB.prepare("INSERT INTO secrets (key, value) VALUES ('site_pass_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(h).run();
}

/** 北京时间日期 YYYY-MM-DD */
export function dayOf(ts) {
  return new Date(ts + 8 * 3600000).toISOString().slice(0, 10);
}
