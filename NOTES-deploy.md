# 部署排障记录（2026-11-22）
- 用户账号疑似撞上 Cloudflare 账号级的 Workers 1101 问题。新 worker fancy-tooth-404c 跑 v1.8.3、绑了 D1 之后，/ping 也返回 1101（约 0.1s），没有日志；编辑器预览正常。没绑 D1 时能显示部署引导页。社区同类帖：979207、979326、945937。
- 代码在 wrangler dev（workerd）里实测正常。
- 备用方案：free-resource-radar-pages.zip（压缩包根目录只有 _worker.js），走 Pages 直接上传。在 Pages 设置里绑 D1 DB 和 ADMIN_TOKEN，然后重新部署。Pages 没有 cron，用 /api/cron?key= 配合 cron-job.org。
- 待办：等用户发 pages.dev 地址，用 curl 测 /ping、/api/health、/。
- 22:35 JST：Pages 部署 10a6e418 能用。/ping 返回 200，其他路径返回 503，提示缺少 DB（当时还没绑 D1）。
- 22:39 JST：用户重新部署时提示 "Your Pages project has been blocked. Contact abusereply@cloudflare.com"，说明是 Cloudflare 那边封禁的，不是代码问题。推测那两次 Workers 1101 也是同一个原因（未确认）。推测的触发点：免费梯子 / proxy 分类（聚合代理节点）。已提议：起草申诉邮件 + 出一个去掉 proxy 分类的版本，等用户回复。不建议换新的 CF 账号绕过封禁。
- 22:41 JST：交付 v1.8.4，按用户要求彻底删掉梯子/proxy（类别、节点源、sub 模式、前台卡片；isProxyTopic 在入库时丢弃；迁移会清理旧数据）。以后不要再加回来。交付物：worker.js、完整 zip、pages zip。已提议帮写申诉邮件。

## v2.0.0 (2026-11-22): moved to Vercel
- User asked to deploy on Vercel instead (CF account blocked). Repo: https://github.com/haru-001/free-resource-radar
- api/index.js = esbuild bundle of src/vercel.js (`npm run bundle`, platform=node). No build step on Vercel (vercel.json installCommand/buildCommand "", outputDirectory public, rewrites /(.*) -> /api/index?__path=$1, maxDuration 60, daily cron /api/vercel-cron 01:00 UTC).
- src/turso.js: D1-compatible shim over Turso /v2/pipeline (batch wrapped in BEGIN/COMMIT). Env TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, ADMIN_TOKEN, optional CRON_SECRET, TICK_BUDGET_MS.
- src/sockets.js: node net/tls replacement for cloudflare:sockets (STARTTLS verified vs smtp.qq.com).
- drainTick in index.js: /api/cron runs autoTick in a loop up to ~45s. Tested: full crawl in 2 triggers via mock Turso (node:sqlite) at /tmp/vt.
- Cloudflare Email provider removed; wrangler.toml, entry.js, dist/ deleted.
- Deploy button includes Turso store param + ADMIN_TOKEN env.
