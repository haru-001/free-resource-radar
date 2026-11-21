# 免费资源雷达 · Cloudflare Workers

每天定时收集**免费域名**和**免费虚拟主机**，只保留半年内、注册简单（仅邮箱或 GitHub / Google 登录）的资源，经 AI 筛选后发邮件日报。

- **采集**：V2EX（免费赠送 / 云计算 / 推广）、NodeSeek、NodeLoc、小众软件、LowEndTalk、LowEndSpirit、Hacker News、GitHub，另可开 Reddit、LINUX DO
- **联网搜索**：Tavily、Keenable、任意联网大模型（Perplexity、OpenAI search 等），中文优先，可设只要中文
- **过滤**：超过 N 天（默认 180）丢弃 → 屏蔽站点 → 噪音标题（求助 / 吐槽）→ 屏蔽规则（关键词 / 正则）→ 关键词预筛 → URL + 标题指纹跨源去重 → AI 判定
- **AI 判定**：任意 OpenAI 兼容接口，后台填 URL + Key，一键获取模型列表、设默认模型。输出分类、获取方式（直接白嫖 / 有条件 / 试用 / 抽奖 / 推广 / 付费）、注册要求、简介、分数
- **推送**：邮件日报（默认 QQ 邮箱 SMTP，也支持 Resend / Brevo / Cloudflare Email Routing）+ Telegram，HTML 适配 Gmail、Outlook、QQ、163、Apple Mail 和手机
- **安全**：URL、Key、授权码、SMTP 账号、Telegram Token 存独立的 secrets 表（绑定 KV 时存 KV），后台只显示打码值；后台需密码
- **界面**：资源页 `/`（列表 / 卡片视图、频道、获取方式筛选、`/` 快捷搜索）、管理 `/admin`、RSS `/feed.xml`、JSON `/api/items`

> 设计语言、部分采集源、噪音标题与获取方式规则参考并移植自 [ZiChuanLan/freebie-radar](https://github.com/ZiChuanLan/freebie-radar)（MIT License）。

## 部署（全程网页操作，只需要一个 D1 数据库）

- **只需 D1**：资源、设置、敏感信息全部可以放 D1（敏感信息在独立的 `secrets` 表，后台只显示打码值）。绑定了 KV（变量名 `SECRETS`）则敏感信息自动改存 KV
- **不用设口令变量**：首次打开 `/admin` 直接设置管理员密码（哈希后存 D1）。想用环境变量也行，加一个 `ADMIN_TOKEN` 密钥即可覆盖
- **不用建表**：首次访问自动建表、自动迁移
- **按日期存储**：每天抓到的资源按北京时间日期归档，默认保留 15 天自动清理（后台可改）；“已见过”的链接记录保留半年，清理后也不会重复推送
- **开箱即用的预设**：数据源、关键词、屏蔽规则、Keenable 免 Key 搜索默认开启；QQ 邮箱 SMTP 已预填，填账号、授权码和收件人后每天自动发

更新代码不会影响数据：数据都在 D1 里，和代码分开。

### A. 连接 GitHub 部署（推荐，推代码自动更新）

1. **上传代码**：GitHub 新建仓库（可以私有）→ Add file → Upload files → 把解压后 `free-resource-radar` 文件夹里的全部内容拖进去 → Commit
2. **导入**：Cloudflare 控制台 → Workers 和 Pages → 创建 → 导入存储库（Import a repository）→ 授权 GitHub → 选仓库
3. **构建设置**：项目名称填 `free-resource-radar`（要和 wrangler.toml 的 name 一致）；构建命令留空；部署命令保持 `npx wrangler deploy` → 保存并部署
4. 部署时会**自动创建并绑定** D1 和 KV，每天的定时任务也自动配好
5. 打开 `https://free-resource-radar.<你的子域>.workers.dev/admin` → 设置管理员密码 → 进后台填 AI、邮箱

### B. 控制台粘贴单文件（最快）

1. **建数据库**：控制台 → 存储和数据库 → D1 SQL 数据库 → 创建，名字随意（如 `free-resource-radar`）
2. **建 Worker**：Workers 和 Pages → 创建 → 从 Hello World 开始 → 名字 `free-resource-radar` → 部署
3. **贴代码**：编辑代码 → 清空 `worker.js` → 粘贴压缩包里 `dist/worker.js` 全部内容 → 部署
4. **绑定数据库**：Worker → 绑定（Bindings）→ 添加绑定 → D1 数据库 → 变量名 `DB` → 选刚建的数据库
5. **定时**：设置 → 触发事件（Triggers）→ 添加 Cron 触发器 → `0 1 * * *`（每天北京 09:00）
6. 打开 `/admin` → 设置管理员密码

以后更新：重新粘贴新版 `dist/worker.js` 再部署，绑定和数据都保留。

> 可选：再绑一个 KV（变量名 `SECRETS`），敏感信息就改存 KV；绑定后在后台点一次「保存设置」完成迁移。

> 部署后请尽快打开 /admin 设置密码：未设置前，第一个打开后台的人可以设定密码。

### 部署自检

没绑 D1 时首页会显示中文提示，告诉你去哪里绑定，补上后刷新即可。

### 命令行（可选）

```bash
npm install && npx wrangler login
npm run deploy           # 自动创建 D1 和 KV
npm run build:single     # 重新生成 dist/worker.js
```

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

本地调试：`cp .dev.vars.example .dev.vars`（填 ADMIN_TOKEN）→ `npm run dev` → 访问 `http://localhost:8787/__scheduled?cron=0+1+*+*+*` 手动触发。

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

- `GET /api/items?category=domain|hosting&obtain=free|conditional&q=关键词&limit=100`
- `GET /api/stats` 各频道计数与最近更新时间
- `GET /feed.xml`
- `/api/admin/*` 需 `Authorization: Bearer <管理员密码>`
