<!-- 发布前把下方按钮链接里的 YOUR_GITHUB 换成你的 GitHub 用户名，仓库需为公开 -->
# 免费资源雷达

每天自动帮你找白嫖资源：免费域名、主机 / VPS、云服务、AI 额度、限免软件、开发工具、喜加一游戏、学生福利……分类在后台勾选。只留半年内发布、注册简单的，AI 筛一遍，每 6 小时更新一次，早晚各发一封到你的 QQ 邮箱（可以发给多个邮箱）。跑在 Cloudflare Workers 免费版里，不用服务器。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_GITHUB/free-resource-radar)

## 它能做什么

- **五个栏目、19 个分类**：福利羊毛（免费域名、主机 / VPS、云服务 / CDN、软件授权、开发工具、游戏、影音会员、设计素材、学生 / 教育、网课教程、网盘资源、实物福利、邀请码）、AI 福利（AI 免费额度、AI 限时福利）、AI 工具与资讯（AI 工具、AI 资讯）、新闻资讯（科技资讯）、免费梯子（节点订阅）。后台按栏目整组勾选，推送也可以只选其中几类
- **AI 福利单独成栏**：长期免费额度和限时福利（限时免费开放、注册送额度、优惠码 / 免费月、公益站签到）分开放。来源有 [Ailyre AI 速递](https://www.ailyre.com/news/) 的「福利速递」、赛博鸡蛋、AI 福利雷达、free-llm-intel、LINUX DO 福利频道、OpenRouter 免费模型和 6 个 GitHub 公益站 / 免费额度清单
- **AI 福利雷达**：每次抓取额外用搜索后端按「福利词 + 轮到的几个厂商」（Claude、Gemini、ChatGPT、DeepSeek、Qwen、Kimi、GLM、豆包、Cursor、Copilot、OpenRouter、硅基流动……可自己改）去搜，选购指南、对比、问答类文章直接丢掉，剩下的交给 AI 整理成「厂商 · 福利类型（免费额度 / 限时免费 / 赠金 / 优惠码 / 免费会员 / 公益站）· 怎么领 · 截止时间」。资源页的 AI 福利栏目可以按厂商和福利类型筛
- **六个用途板块**：本周精选（近 7 天综合评分前 10）、即将截止（按截止时间排）、兑换码（一键复制）、签到（每天勾选，记在自己浏览器里）、学生 / 开发者专区（GitHub 学生包、JetBrains、Cloudflare、Oracle 等长期权益）、我的收藏
- **值 / 不值投票**：每条都能投，参与排序；「不值」明显多的自动隐藏，也会作为反例告诉 AI
- **失效检测**：每次抓取后抽查一批链接，打不开（404）或写着已结束的标为「可能失效」沉到最后；写明截止时间的过期一天后自动下架
- **关键词提醒**：设几个关注的词（如 Claude、域名），新资源命中就立刻单独推送，不等日报
- **GitHub 同类清单自动同步**：内置 6 个持续更新的中文 AI 免费额度 / 公益站清单仓库，仓库一有新提交，就把新增的条目同步过来；批量添加里贴 `github.com/作者/仓库` 也能加
- **免费梯子**：8 个 GitHub 上自动更新的公共节点订阅仓库，每个仓库一张卡片，显示最近更新时间，订阅地址一键复制。公共节点来路不明，别用来登录重要账号
- **新闻资讯**：量子位、free-llm-intel 厂商动态、Solidot、爱范儿、cnBeta、极客公园、阮一峰周刊，每个源每次只取最新几条
- **可选英文来源**：LowEndTalk、LowEndSpirit、Hacker News、GitHub、Reddit（默认关闭）
- **白嫖专源直通**：反斗限免、IT之家喜加一 / 限免、Epic 每周免费游戏、GamerPower、OpenRouter 免费模型、SharewareOnSale，本身就是免费资源，不经 AI 直接入库，省额度
- **中文来源**：V2EX、NodeSeek、NodeLoc、小众软件、如有乐享、异次元软件世界、蓝点网
- **联网搜索**：AnySearch、Keenable 免 Key 默认开启，另支持 Tavily、Exa、Brave、百度千帆、火山引擎，多家并行
- **过滤**：半年以上丢弃 → 屏蔽站点 → 求助 / 吐槽类标题 → 关键词与正则屏蔽 → 跨来源去重 → AI 判定
- **AI 判定**：任意 OpenAI 兼容接口，后台填地址和 Key，一键拉取模型列表。输出分类、获取方式（直接白嫖 / 有条件 / 试用 / 抽奖 / 推广 / 付费）、注册要求和简介
- **智能审核，省 AI 额度**：默认只把拿不准的交给 AI。标题写明免费、归得进分类、没有价格 / 抽奖 / 推广字样的自动通过；提问帖和明确付费的自动拒绝。想每条都过 AI，后台「审核方式」改成严格
- **推送**：邮件日报（默认 QQ 邮箱，也支持 Resend / Brevo / Cloudflare Email Routing）、Telegram、企业微信、钉钉、飞书、Server 酱、PushPlus、Bark 和通用 Webhook；可选每周精选
- **按发布时间排序**：首页按发布日期分组，最新的在最前；发布超过 15 天的单独折叠在最后（天数可调），邮件里也单独成组。默认保留 15 天，自动清理
- **只要中文**：默认过滤纯英文内容（标题和正文都没有中文就丢弃），可在后台关闭
- **访问密码（可选）**：资源页和 RSS 可以加密码，不想公开就设一个
- **更省额度、更整齐**：同一个目标地址判过一次就复用 AI 结论；标题自动去掉「【转】」「- 某某社区」这类前后缀；AI 摘要固定成「送什么 + 限制」，另给「怎么领」和截止日期；搜索结果标题必须写明免费；资讯和 GitHub 源可以设抓取间隔（错峰）
- **安全与迁移**：密码错太多次锁定 15 分钟，公开接口按 IP 限频；后台一键导出 / 导入全部设置
- **界面**：资源页 `/`、管理后台 `/admin`、RSS `/feed.xml`、JSON `/api/items`

## 一键部署（推荐）

1. 点上方 **Deploy to Cloudflare** 按钮，登录 Cloudflare，按提示连接 GitHub 账号
2. 部署页面会列出要创建的资源，**全部保持默认**：
   - D1 数据库 `DB`：存资源、设置（自动创建）
   - KV 命名空间 `SECRETS`：存 Key、邮箱授权码等敏感信息（自动创建）
   - 密钥 `ADMIN_TOKEN`：后台登录密码，**改成你自己的一串长密码**
3. 点「创建并部署」，等一两分钟
4. 打开部署好的地址，后面加 `/admin`，用刚设的密码登录
5. 在后台填好下面「第一次使用」里的几项，完事

数据表首次访问时自动创建；定时任务也已随部署配好，不用手动加。

之后更新：在 Cloudflare 自动为你创建的那个仓库里同步新代码，会自动重新部署。数据都在 D1 里，更新代码不会丢数据和设置。

## 手动部署（不想连 GitHub）

适合只想在 Cloudflare 控制台里点几下的情况，只需要一个 D1 数据库。

1. [Cloudflare 控制台](https://dash.cloudflare.com/) → 存储和数据库 → D1 SQL 数据库 → 创建，名字随意
2. Workers 和 Pages → 创建 → 从 Hello World 开始，名字填 `free-resource-radar` → 部署
3. 点「编辑代码」，清空编辑器里的 `worker.js`，粘贴本项目 [`dist/worker.js`](dist/worker.js) 的全部内容 → 部署
4. Worker → 绑定 → 添加绑定 → D1 数据库，变量名填 `DB`，选第 1 步建的库
5. 设置 → 触发事件 → 添加 Cron 触发器，填 `* * * * *`（每分钟一次，原因见「重点提示」）
6. 打开 `你的地址/admin`，首次进入会让你设置管理员密码

之后更新：重新粘贴新版 `dist/worker.js` 再部署，绑定和数据都会保留。

## 第一次使用

后台按这个顺序填，每一项都有「测试」按钮。改了设置会在底部提示「有 N 项修改还没保存」，点保存或按 Ctrl+S；点左上角图标回到资源页。

1. **采集与分类**：勾选想收集的分类，设好多久抓一次（默认每 6 小时）
2. **推送**：QQ 邮箱地址、授权码、收件人（可以填多个），推送时间默认早晚各一次。服务器 `smtp.qq.com:465` 已预填，填好即生效
3. **AI 与搜索**：AI 可选，填接口地址和 Key，获取模型、选好、保存，再点「测试」。不填就按关键词判定，配好后可以「用 AI 重新判定」。联网搜索里 AnySearch、Keenable 免 Key 已开启，其余几家按注册链接拿免费 Key 填上就会参与
4. 回到「资源审核」点 **立即抓取**（显示每一步进度，约半分钟），看看第一批结果；再到「推送」点 **发送测试邮件**


## 重点提示

> **密码**：一键部署时请把 `ADMIN_TOKEN` 改成自己的密码；如果保留默认的 `change-me`，会视为未设置。手动部署没设 `ADMIN_TOKEN` 时，**第一个打开 /admin 的人**可以设定密码，所以部署完请立刻去设置。

> **资源页访问密码**：默认公开。后台「账号与安全」可以设访问密码，设置后打开资源页要先输入，RSS 地址改为 `/feed.xml?key=访问密码`。

> **QQ 邮箱要用授权码，不是 QQ 密码**。获取方法见下文。发件人必须和登录账号一致。

> **数据保留 15 天**：资源按抓取日期存储，过期自动删除，后台「采集与分类」可改天数。已见过的链接会记住半年，不会因为清理而重复推送。

> **只推新内容**：默认只推上次之后新通过的资源，这一轮没有新内容就不发，不是坏了。想每次都收到，在后台打开「没有新内容也推」。

> **默认只要中文**：纯英文内容默认过滤，所以 LowEndTalk、Hacker News、GitHub 这类英文源默认关闭。Epic、GamerPower、OpenRouter、SharewareOnSale 这几个白嫖专源带中文简介，照常收录。想要英文资源：后台「采集与分类」关掉「过滤纯英文内容」，再在数据源里打开对应的源。

> **部分来源会被拦**：Reddit、LINUX DO 屏蔽 Cloudflare 的服务器 IP，默认关闭。

> **为什么定时任务是每分钟一次**：Workers 免费版每次调用只有 10ms CPU、最多 50 个外部请求，一口气抓完所有来源会超限被掐断。所以每次抓取被拆成一步一步（每个数据源、每批 AI 判定、清理、推送各一步），每分钟执行一步，十几二十分钟跑完。没有任务时每次调用只查一下数据库，几乎不耗资源。抓取频率在后台「采集与分类」里改（默认北京 09:00 起每 6 小时）；付费版可以把「每次触发执行几步」调大。

> **免费额度**：每分钟一次的定时任务一天 1440 次，远低于免费版每天 10 万次请求；D1 免费版 5GB，个人使用绰绰有余。AI 调用按你自己的接口计费，每次最多判定 60 条（可调）。

> **没配 AI 也能用**：会用关键词判定，结果粗一些；GitHub、HN 讨论类这些噪音大的源会自动跳过，配好 AI 后自动启用。

> **敏感信息存放**：绑定了 KV（`SECRETS`）时存 KV，没绑定时存 D1 里单独的 `secrets` 表；后台始终只显示打码值。

> **出问题先看首页**：缺少必需的绑定时，首页会直接显示中文提示，告诉你还差哪一步。抓取和推送的详细日志在后台「运行记录」。

## QQ 邮箱日报（默认）

1. QQ 邮箱网页版 → 设置 → 账号与安全 → 安全设置 → 开启 **POP3/IMAP/SMTP 服务**，生成**授权码**
2. 后台「推送」：发送方式保持 SMTP，服务器 `smtp.qq.com`、端口 `465`、SSL 已预填
3. 填 QQ 邮箱账号、授权码、收件人 → 保存 → 发送测试邮件 → 打开「启用」

邮件通过 Workers 的 TCP Sockets 直连 SMTP（465 SSL / 587 STARTTLS 都支持）。其他邮箱改服务器即可，例如 163：`smtp.163.com:465`。

## 联网搜索

全部默认开启，开启的几家并行搜索。免 Key 的直接能用；需要 Key 的注册拿到免费额度后填进后台就自动参与，没填就跳过。搜索词按勾选的分类自动生成（中文为主）。

| 服务 | Key | 免费额度 | 注册 |
|---|---|---|---|
| AnySearch | 可选 | 免 Key 每天 1000 次（按 IP），中文结果好 | [anysearch.com](https://www.anysearch.com) |
| Keenable | 可选 | 免 Key 每小时 1000 次（按 IP）；注册后每月 10 万次 | [keenable.ai](https://keenable.ai) |
| Tavily | 需要 | 每月 1000 credits，不用绑卡 | [app.tavily.com](https://app.tavily.com) |
| Exa | 需要 | 每月 $10 额度 | [dashboard.exa.ai](https://dashboard.exa.ai) |
| Brave Search | 需要 | 每月 $5 额度 | [api-dashboard.search.brave.com](https://api-dashboard.search.brave.com) |
| 百度千帆搜索 | 需要 | 每月 1500 次，需实名 | [接入文档](https://cloud.baidu.cn/doc/qianfan/s/nmweljpt3) |
| 火山引擎联网搜索 | 需要 | 每月 500 次 | [接入文档](https://docs.volcengine.com/docs/networked-search/networked-search?lang=zh) |

额度为 2026-11-17 核实的数据（来自 bestnite/search），以各家官网为准。

## 数据源与分类管控

后台「采集与分类 → 数据源」：

- **列表管理**：开关、搜索、删除，点「＋ 添加」粘贴 RSS 地址或 Telegram 频道（`@频道名`）即可
- **分类管控**：点某个源右侧的分类，限定它只收哪些分类（比如主机博客只收「主机 / VPS、免费域名」），其它分类的内容直接丢弃；还可以设「默认分类」（关键词归不了类时用）和「标题必须包含」。抓到的内容照常经过时间、中文、噪音、屏蔽规则、关键词和 AI 过滤
- **搜索后端也能管控**：「AI 与搜索」里每个搜索后端下有「负责分类」，只用这些分类生成搜索词，结果也只收这些分类
- **↻ 更新源**：一键拉取新源，勾选后添加。来源有三处：本项目内置推荐（升级后新增的源会出现在这里）、[freebie-radar](https://github.com/ZiChuanLan/freebie-radar) 的内置源（自动把它的 RSS / V2EX / Telegram / Epic 等源转成本项目格式）、你自己填的地址（JSON 数组，格式同「以 JSON 编辑」）。英文站、机房常被拦的、资讯类的源默认不勾选

**三种加源方式**：「↻ 更新源」拉内置推荐和 freebie-radar；「⌕ 发现新源」用已开启的搜索后端搜关键词，自动找结果网站的 RSS 并检测条目数、更新时间、是不是中文；「＋ 批量添加」一次贴最多 15 个网址 / t.me 链接 / @频道，网页会自动找订阅地址。资源审核里每条都有「订阅此站」，一键把来源网站加进来。

**同一资源多个来源自动合并**：链接相同、TG 消息指向同一篇原文、正文里指向同一个外部地址（邀请参数不同也算同一个），或者标题几乎一样，都会折叠成一条，标注「N 个来源」，每个来源都能点开；邮件里也合并显示。同一个站每篇都带的页脚 / 赞助链接不算。

内置了 20 多个 2026 年 11 月实测可用的中文源：零度解说、A姐分享（网站 + TG 频道）、福利吧、少数派（只收限免）、果核剥壳、异星软件空间、克隆窝、翻应用、FreeGroup、其乐、VPS 精选网、老左笔记、主机百科、VPS 侦探、VEIDC、VPSGO、xiaoz 博客等，主机类博客默认只收主机 / 域名 / 云服务。

## 定时与触发

`wrangler.toml` 中 `crons = ["* * * * *"]`：每分钟检查一次，按后台「采集与分类 → 定时与触发」的设置执行：

- **抓取**：默认从北京 09:00 起每 6 小时一次（09:00、15:00、21:00、03:00），每次拆成十几步，每分钟一步，约 15–20 分钟跑完。可改成每 2 / 3 / 4 / 8 / 12 小时或每天一次
- **推送**：默认每天 09:00、21:00 两次。到点时如果正在抓取，会等抓完再推；每次只推上次之后新通过的资源，没有新内容不发。超过推送时间 3 小时还没发出就跳过这一次
- **多个收件人**：后台「推送」里逐个添加，最多 10 个；默认每人单独一封，互相看不到地址

**触发地址**（后台「采集与分类 → 定时与触发」里复制）：`https://你的域名/api/cron?key=触发密钥`。访问一次就推进一步，到点了会自动开始当天的抓取。用法：

- 想多一层保险：填到 [cron-job.org](https://cron-job.org) 或 [UptimeRobot](https://uptimerobot.com)，每 1–5 分钟访问一次
- 没开 Cloudflare 定时也能用：外部服务每分钟访问，效果一样
- 有最小间隔（默认 30 秒），间隔内的请求直接返回、不执行；密钥可以在后台一键更换
- 可选「有人打开资源页时顺带推进一步」，默认关闭

**缓存**：资源页数据默认缓存 60 秒（后台可改，0 为不缓存），缓存期内打开页面不查数据库；页面带 ETag，没变化时浏览器直接用本地副本。后台有改动会立即刷新缓存。

## 数据源格式

```json
[
  { "name": "V2EX · 免费赠送", "type": "v2ex", "node": "free" },
  { "name": "NodeSeek", "type": "rss", "url": "https://rss.nodeseek.com/" },
  { "name": "HN", "type": "hn", "query": "\"free hosting\"" },
  { "name": "GitHub", "type": "github", "query": "free domain" },
  { "name": "Reddit", "type": "reddit", "query": "free domain", "subreddit": "webhosting", "enabled": false },
  { "name": "全是资源的源", "type": "rss", "url": "https://...", "filter": false },
  { "name": "白嫖专源", "type": "rss", "url": "https://...", "category": "software", "trusted": true, "include": "100% discount|free" }
]
```

- `filter: false`：跳过关键词预筛
- `trusted: true` + `category`：内容本身就是免费资源，直接入库，不送 AI
- `include`：标题必须匹配的正则
- `ai_only: true`：只有配置了 AI 时才抓（噪音大的源）
- `limit`：每次最多收几条（资讯类源用）
- `every`：至少隔几小时才抓一次（错峰，手动抓取不受限）
- `tags` / `skip_tags`：按 feed 里的 `<category>` 标签筛，只收 / 不收某几类（比如 Ailyre 的「福利速递」）
- 内置类型：`rss`、`telegram`（`channel`）、`v2ex`（`node`）、`repo`、`hn`、`github`（仓库搜索）、`reddit`、`epic`、`gamerpower`、`openrouter_free`

GitHub 仓库（`repo`）有两种用法：

```json
{ "name": "某个免费清单", "type": "repo", "repo": "作者/仓库", "mode": "diff", "path": "README\\.md$", "category": "ai", "trusted": true }
{ "name": "某个节点仓库", "type": "repo", "repo": "作者/仓库", "mode": "sub", "category": "proxy", "trusted": true, "subs": [["V2Ray", "https://raw.githubusercontent.com/..."]] }
```

- `mode: "diff"`：读仓库的提交记录，把新提交里新增的表格行 / 列表项变成资源（第一次只看最近 2 次提交）。`path` 是只看哪些文件的正则，默认所有 `.md`
- `mode: "sub"`：一个仓库只占一条，每次有新提交就刷新时间；`subs` 是要展示的订阅地址
- 读的是 `github.com/作者/仓库/commits.atom` 和提交的 `.patch`，不走 GitHub API，不需要 Token，也不占 API 限额

## 接口

- `GET /api/data` 资源页用的数据（近 15 天的已通过条目、本周精选、专区、签到清单），带缓存和 ETag；`?old=1` 取更早发布的
- `POST /api/vote` `{"id": "...", "v": 1 | -1 | 0}` 值 / 不值投票
- `GET /api/items?category=ai|game|…&obtain=free|conditional&day=2026-11-21&q=关键词&limit=100`
- `GET /api/stats` 各频道计数、按日期计数、最近更新时间
- `GET /feed.xml`
- `GET /api/cron?key=触发密钥` 推进一步抓取（见上文）
- 设置了访问密码时，资源页相关接口需要 Cookie（网页登录后自动带上）或 `?key=访问密码`
- `/api/admin/*` 需 `Authorization: Bearer <管理员密码>`

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars        # 填 ADMIN_TOKEN
npm run dev                           # 访问 http://localhost:8787
curl "http://localhost:8787/__scheduled?cron=0+1+*+*+*"   # 手动触发定时任务
npm run deploy                        # 命令行部署，D1 和 KV 会自动创建
npm run build:single                  # 改完源码后重新生成 dist/worker.js
```

## 致谢

- 各数据源归原作者所有，本项目只读取它们公开的 RSS、频道页和 GitHub 提交记录并链回原文，没有复制代码或内容：[Ailyre AI 速递](https://www.ailyre.com/news/)、[rockbenben/free-llm-intel](https://github.com/rockbenben/free-llm-intel)、[kirito8/free-newapi](https://github.com/kirito8/free-newapi)、[bubblevv/ai-api-gongyi-nav](https://github.com/bubblevv/ai-api-gongyi-nav)、[KJAI123/awesome-free-ai-tokens-cn](https://github.com/KJAI123/awesome-free-ai-tokens-cn)、[peter123023/awesome-free-llm-api](https://github.com/peter123023/awesome-free-llm-api)、[AIPMAndy/FreeToken](https://github.com/AIPMAndy/FreeToken)、[CYBIRD-D/FREE-LLM-API-Provider](https://github.com/CYBIRD-D/FREE-LLM-API-Provider)，以及免费梯子栏目里列出的各节点仓库
- 设计语言、部分采集源、噪音标题与获取方式规则参考并移植自 [ZiChuanLan/freebie-radar](https://github.com/ZiChuanLan/freebie-radar)（MIT License），许可证见 `THIRD_PARTY_LICENSE_freebie-radar.txt`
- 联网搜索各家的接口格式与免费额度参考 [bestnite/search](https://github.com/bestnite/search)（MIT License）的 BACKENDS.md，许可证见 `THIRD_PARTY_LICENSE_bestnite-search.txt`
