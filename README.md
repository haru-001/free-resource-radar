<!-- 发布前把下方按钮链接里的 YOUR_GITHUB 换成你的 GitHub 用户名，仓库需为公开 -->
# 免费资源雷达

每天自动帮你找**免费域名**和**免费虚拟主机**：只留半年内发布、注册简单（邮箱或 GitHub / Google 登录即可）的资源，AI 筛一遍，早上 9 点发到你的 QQ 邮箱。跑在 Cloudflare Workers 免费额度里，不用服务器。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/haru-001/free-resource-radar)

## 它能做什么

- **采集**：V2EX（免费赠送 / 云计算 / 推广）、NodeSeek、NodeLoc、小众软件、LowEndTalk、LowEndSpirit、Hacker News、GitHub，另可开 Reddit、LINUX DO
- **联网搜索**：Keenable（免 Key，默认开启）、Tavily、任意联网大模型，中文优先
- **过滤**：半年以上丢弃 → 屏蔽站点 → 求助 / 吐槽类标题 → 关键词与正则屏蔽 → 跨来源去重 → AI 判定
- **AI 判定**：任意 OpenAI 兼容接口，后台填地址和 Key，一键拉取模型列表。输出分类、获取方式（直接白嫖 / 有条件 / 试用 / 抽奖 / 推广 / 付费）、注册要求和简介
- **推送**：邮件日报（默认 QQ 邮箱，也支持 Resend / Brevo / Cloudflare Email Routing）和 Telegram，适配 Gmail、Outlook、QQ、163、Apple Mail 和手机
- **按日期归档**：首页按天分组浏览，默认保留 15 天，自动清理
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

数据表首次访问时自动创建；每天北京时间 09:00 的定时任务也已随部署配好，不用手动加。

之后更新：在 Cloudflare 自动为你创建的那个仓库里同步新代码，会自动重新部署。数据都在 D1 里，更新代码不会丢数据和设置。

## 手动部署（不想连 GitHub）

适合只想在 Cloudflare 控制台里点几下的情况，只需要一个 D1 数据库。

1. [Cloudflare 控制台](https://dash.cloudflare.com/) → 存储和数据库 → D1 SQL 数据库 → 创建，名字随意
2. Workers 和 Pages → 创建 → 从 Hello World 开始，名字填 `free-resource-radar` → 部署
3. 点「编辑代码」，清空编辑器里的 `worker.js`，粘贴本项目 [`dist/worker.js`](dist/worker.js) 的全部内容 → 部署
4. Worker → 绑定 → 添加绑定 → D1 数据库，变量名填 `DB`，选第 1 步建的库
5. 设置 → 触发事件 → 添加 Cron 触发器，填 `0 1 * * *`（每天北京 09:00）
6. 打开 `你的地址/admin`，首次进入会让你设置管理员密码

之后更新：重新粘贴新版 `dist/worker.js` 再部署，绑定和数据都会保留。

## 第一次使用

后台按这个顺序填，每一项都有「测试」按钮：

1. **邮件与推送**：QQ 邮箱地址、授权码、收件人。服务器 `smtp.qq.com:465` 已预填，邮件开关默认开启，填好即生效
2. **AI 引擎**：接口地址 + Key → 获取模型 → 选默认模型 → 保存。不填也能跑，会退回关键词判定，结果会粗一些
3. **联网搜索**：Keenable 已默认开启；有 Tavily Key 的话填上并打开
4. 回到「资源审核」点 **立即抓取**，看看第一批结果；点 **发送测试邮件** 确认能收到

## 重点提示

> **密码**：一键部署时请把 `ADMIN_TOKEN` 改成自己的密码；如果保留默认的 `change-me`，会视为未设置。手动部署没设 `ADMIN_TOKEN` 时，**第一个打开 /admin 的人**可以设定密码，所以部署完请立刻去设置。

> **QQ 邮箱要用授权码，不是 QQ 密码**。获取方法见下文。发件人必须和登录账号一致。

> **数据保留 15 天**：资源按抓取日期存储，过期自动删除，后台「采集与过滤」可改天数。已见过的链接会记住半年，不会因为清理而重复推送。

> **只推新内容**：默认只推上次之后新通过的资源，当天没有新内容就不发，不是坏了。想每天都收到，在后台打开「没有新内容也推」。

> **部分来源会被拦**：Reddit、LINUX DO 屏蔽 Cloudflare 的服务器 IP，默认关闭。

> **免费额度**：Workers 免费版每天 10 万次请求、D1 免费版 5GB，个人使用绰绰有余。抓取时 AI 调用按你自己的接口计费。

> **敏感信息存放**：绑定了 KV（`SECRETS`）时存 KV，没绑定时存 D1 里单独的 `secrets` 表；后台始终只显示打码值。

> **出问题先看首页**：缺少必需的绑定时，首页会直接显示中文提示，告诉你还差哪一步。抓取和推送的详细日志在后台「运行记录」。

## QQ 邮箱日报（默认）

1. QQ 邮箱网页版 → 设置 → 账号与安全 → 安全设置 → 开启 **POP3/IMAP/SMTP 服务**，生成**授权码**
2. 后台「邮件与推送」：发送方式保持 SMTP，服务器 `smtp.qq.com`、端口 `465`、SSL 已预填
3. 填 QQ 邮箱账号、授权码、收件人 → 保存 → 发送测试邮件 → 打开「启用」

邮件通过 Workers 的 TCP Sockets 直连 SMTP（465 SSL / 587 STARTTLS 都支持）。其他邮箱改服务器即可，例如 163：`smtp.163.com:465`。

## 联网搜索

| 服务 | 需要 | 说明 |
|---|---|---|
| Tavily | API Key（tvly-…） | 中文查询自动 `language=zh-cn`，只要中文时严格过滤；按发布日期过滤 |
| Keenable | 可选 API Key（keen_…） | 不填 Key 走免费公共接口（按 IP 限流）；`published_after` 过滤 |
| 联网模型 | OpenAI 兼容地址 + Key + 模型 | Perplexity `sonar` + `{"search_recency_filter":"month"}`；OpenAI `gpt-4o-search-preview` + `{"web_search_options":{}}` |

搜索词在后台可改（默认中文为主、带两条英文）。

## 定时

`wrangler.toml` 中 `crons = ["0 1 * * *"]`：每天 UTC 01:00（北京 09:00 / 东京 10:00）先抓取，再按启用的渠道推送。默认只推上次之后新通过的资源，没有新内容就不推。


## 数据源格式

```json
[
  { "name": "V2EX · 免费赠送", "type": "v2ex", "node": "free" },
  { "name": "NodeSeek", "type": "rss", "url": "https://rss.nodeseek.com/" },
  { "name": "HN", "type": "hn", "query": "\"free hosting\"" },
  { "name": "GitHub", "type": "github", "query": "free domain" },
  { "name": "Reddit", "type": "reddit", "query": "free domain", "subreddit": "webhosting", "enabled": false },
  { "name": "全是资源的源", "type": "rss", "url": "https://...", "filter": false }
]
```

## 接口

- `GET /api/items?category=domain|hosting&obtain=free|conditional&day=2026-11-21&q=关键词&limit=100`
- `GET /api/stats` 各频道计数、按日期计数、最近更新时间
- `GET /feed.xml`
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

设计语言、部分采集源、噪音标题与获取方式规则参考并移植自 [ZiChuanLan/freebie-radar](https://github.com/ZiChuanLan/freebie-radar)（MIT License），许可证见 `THIRD_PARTY_LICENSE_freebie-radar.txt`。
