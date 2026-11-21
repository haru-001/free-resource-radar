<!-- 发布前把下方按钮链接里的 YOUR_GITHUB 换成你的 GitHub 用户名，仓库需为公开 -->
# 免费资源雷达

每天自动帮你找白嫖资源：免费域名、主机 / VPS、云服务、AI 额度、限免软件、开发工具、喜加一游戏、学生福利……分类在后台勾选。只留半年内发布、注册简单的，AI 筛一遍，早上 9 点发到你的 QQ 邮箱。跑在 Cloudflare Workers 免费版里，不用服务器。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/haru-001/free-resource-radar)

## 它能做什么

- **14 个分类，后台勾选**：免费域名、主机 / VPS、云服务 / CDN、AI 额度、软件授权、开发工具、游戏、影音会员、设计素材、学生 / 教育、网课教程、网盘资源、实物福利、邀请码。默认开 8 个，推送也可以只选其中几类
- **可选英文来源**：LowEndTalk、LowEndSpirit、Hacker News、GitHub、Reddit（默认关闭）
- **白嫖专源直通**：反斗限免、IT之家喜加一 / 限免、Epic 每周免费游戏、GamerPower、OpenRouter 免费模型、SharewareOnSale，本身就是免费资源，不经 AI 直接入库，省额度
- **中文来源**：V2EX、NodeSeek、NodeLoc、小众软件、如有乐享、异次元软件世界、蓝点网
- **联网搜索**：AnySearch、Keenable 免 Key 默认开启，另支持 Tavily、Exa、Brave、百度千帆、火山引擎，多家并行
- **过滤**：半年以上丢弃 → 屏蔽站点 → 求助 / 吐槽类标题 → 关键词与正则屏蔽 → 跨来源去重 → AI 判定
- **AI 判定**：任意 OpenAI 兼容接口，后台填地址和 Key，一键拉取模型列表。输出分类、获取方式（直接白嫖 / 有条件 / 试用 / 抽奖 / 推广 / 付费）、注册要求和简介
- **推送**：邮件日报（默认 QQ 邮箱，也支持 Resend / Brevo / Cloudflare Email Routing）和 Telegram，适配 Gmail、Outlook、QQ、163、Apple Mail 和手机
- **按日期归档**：首页按天分组浏览，默认保留 15 天，自动清理
- **只要中文**：默认过滤纯英文内容（标题和正文都没有中文就丢弃），可在后台关闭
- **访问密码（可选）**：资源页和 RSS 可以加密码，不想公开就设一个
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

后台按这个顺序填，每一项都有「测试」按钮：

1. **分类订阅**：勾选想收集的分类
2. **邮件与推送**：QQ 邮箱地址、授权码、收件人。服务器 `smtp.qq.com:465` 已预填，邮件开关默认开启，填好即生效
3. **AI 引擎（可选）**：接口地址 + Key → 获取模型 → 选默认模型 → 保存 → 点「测试」。不填也能跑，用关键词判定，结果粗一些；配好后点「用 AI 重新判定」，把之前关键词判定过的条目交给 AI 再判一遍
4. **联网搜索**：AnySearch、Keenable 免 Key 已开启；想要更多结果，按后台的注册链接拿 Tavily、Exa 等的免费 Key 填上
5. 回到「资源审核」点 **立即抓取**（页面会显示每一步进度，约半分钟），看看第一批结果；点 **发送测试邮件** 确认能收到

## 重点提示

> **密码**：一键部署时请把 `ADMIN_TOKEN` 改成自己的密码；如果保留默认的 `change-me`，会视为未设置。手动部署没设 `ADMIN_TOKEN` 时，**第一个打开 /admin 的人**可以设定密码，所以部署完请立刻去设置。

> **资源页访问密码**：默认公开。后台「账号与存储」可以设访问密码，设置后打开资源页要先输入，RSS 地址改为 `/feed.xml?key=访问密码`。

> **QQ 邮箱要用授权码，不是 QQ 密码**。获取方法见下文。发件人必须和登录账号一致。

> **数据保留 15 天**：资源按抓取日期存储，过期自动删除，后台「采集与过滤」可改天数。已见过的链接会记住半年，不会因为清理而重复推送。

> **只推新内容**：默认只推上次之后新通过的资源，当天没有新内容就不发，不是坏了。想每天都收到，在后台打开「没有新内容也推」。

> **默认只要中文**：纯英文内容默认过滤，所以 LowEndTalk、Hacker News、GitHub 这类英文源默认关闭。Epic、GamerPower、OpenRouter、SharewareOnSale 这几个白嫖专源带中文简介，照常收录。想要英文资源：后台「采集与过滤」关掉「纯英文内容 过滤」，再在数据源里打开对应的源。

> **部分来源会被拦**：Reddit、LINUX DO 屏蔽 Cloudflare 的服务器 IP，默认关闭。

> **为什么定时任务是每分钟一次**：Workers 免费版每次调用只有 10ms CPU、最多 50 个外部请求，一口气抓完所有来源会超限被掐断。所以每次抓取被拆成一步一步（每个数据源、每批 AI 判定、清理、推送各一步），每分钟执行一步，十几二十分钟跑完，最后一步发邮件。没有任务时每次调用只查一下数据库，几乎不耗资源。抓取时间在后台「采集与过滤」里改（默认北京 09:00）；付费版可以把「每分钟执行几步」调大。

> **免费额度**：每分钟一次的定时任务一天 1440 次，远低于免费版每天 10 万次请求；D1 免费版 5GB，个人使用绰绰有余。AI 调用按你自己的接口计费，每次最多判定 60 条（可调）。

> **没配 AI 也能用**：会用关键词判定，结果粗一些；GitHub、HN 讨论类这些噪音大的源会自动跳过，配好 AI 后自动启用。

> **敏感信息存放**：绑定了 KV（`SECRETS`）时存 KV，没绑定时存 D1 里单独的 `secrets` 表；后台始终只显示打码值。

> **出问题先看首页**：缺少必需的绑定时，首页会直接显示中文提示，告诉你还差哪一步。抓取和推送的详细日志在后台「运行记录」。

## QQ 邮箱日报（默认）

1. QQ 邮箱网页版 → 设置 → 账号与安全 → 安全设置 → 开启 **POP3/IMAP/SMTP 服务**，生成**授权码**
2. 后台「邮件与推送」：发送方式保持 SMTP，服务器 `smtp.qq.com`、端口 `465`、SSL 已预填
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

## 定时

`wrangler.toml` 中 `crons = ["* * * * *"]`：每分钟检查一次。到了后台设置的时间（默认北京 09:00）新建当天的抓取，之后每分钟执行一步，全部完成后按启用的渠道推送。默认只推上次之后新通过的资源。


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
- 内置类型：`rss`、`v2ex`（`node`）、`hn`、`github`、`reddit`、`epic`、`gamerpower`、`openrouter_free`

## 接口

- `GET /api/items?category=ai|game|…&obtain=free|conditional&day=2026-11-21&q=关键词&limit=100`
- `GET /api/stats` 各频道计数、按日期计数、最近更新时间
- `GET /feed.xml`
- 设置了访问密码时，以上接口需要 Cookie（网页登录后自动带上）或 `?key=访问密码`
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

- 设计语言、部分采集源、噪音标题与获取方式规则参考并移植自 [ZiChuanLan/freebie-radar](https://github.com/ZiChuanLan/freebie-radar)（MIT License），许可证见 `THIRD_PARTY_LICENSE_freebie-radar.txt`
- 联网搜索各家的接口格式与免费额度参考 [bestnite/search](https://github.com/bestnite/search)（MIT License）的 BACKENDS.md，许可证见 `THIRD_PARTY_LICENSE_bestnite-search.txt`
