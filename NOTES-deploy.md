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

## v2.1.0 (2026-11-23)
- Crawl step `translate` (after judge, also in rejudge): approved items from last 30 days with no CJK title, 15/step; AI translateBatch → extra.zh + extra.project (repo regex first, else AI pick from given links). Public/mail/Telegram show zh title, grey original, 项目地址 button. translate_english='false' disables. Not end-to-end tested.
- esbuild install: fresh /tmp dir with `echo '{}' > package.json` first (else EACCES on /node_modules).

## v2.2.0 (2026-11-23)
- Public nav: groups in a scrollable row; virtual views moved into a 精选 ▾ dropdown (#more, bottom sheet on mobile); counts hidden on mobile.
- Mail redesigned: gradient header with per-category counts, card per item (colored left bar, pills, how box, dashed codes, 查看详情/项目地址 buttons). Webhook markdown grouped by category with zh titles + project link.

## v2.3.0 (2026-11-23)
- Mail: ⭐ 今日精选 top N by score (mail_top_n default 3, shown when items > N+2), reason = AI summary. mail_min_score filter (default 0). mail_dedup (default true): meta:mailed keeps last 1500 ids + t:target, skipped in later reports. Admin push page has the three settings; admin mobile CSS pass (16px inputs, scrollable tables/chips, 36px buttons).

## v2.4.0 (2026-11-23, v3 roadmap phase 1)
- .github/workflows/ci.yml (bundle + diff check + npm test), cron.yml (every 15 min, secret RADAR_TRIGGER_URL), test/smoke.mjs. healthAlert in crawler.js after run finishes (alert_enabled, alert_min_errors=3, meta alert_last 6h throttle, alert_fail_streak).
- Remaining roadmap: 一.4 Postgres, 一.5 backup/migrate, 二.1 AI dedup, 二.2 expiry recheck, 二.3 source score, 二.4 cheap+good model, 三.1 per-recipient prefs, 三.2 PWA, 三.3 claimed mark, 三.4 dark mail/weekly, 四 split html + settings migration.
- v2.5.0: expiryRemind (expiry_remind, meta reminded) runs in check step; link check prioritizes items with expires_at. User (2026-11-23): personal use only, NO per-recipient subscriptions (drop 三.1).
- v2.6.0: PWA (public/manifest.webmanifest, sw.js network-first cache for / and /api/data, icon.svg/png). 「领过了」mark: localStorage frr_claimed, claimed items hidden from lists, view v:claimed.
- v2.7.0: sourceScores (30d approve rate*0.8 + vote share*20; low = n>=30 && ok<=max(1,3%)), shown in admin health; source_auto_slow skips low sources if fetched in last 23h. ai_model_cheap: cheap pre-judge, keep relevant or score>=40 for main model.
- v3.0.0: dedupStep (ai_dedup; same category + normalized AI name/zh title, 14d, keeper=highest score, others rejected judged_by dup, sources appended). Dark-mode mail (dk-* classes), weekly mail rank badges (_weekly). migrateSettings in getSettings (cloudflare→smtp, any→zh_first). Export ?items=1 (approved, no raw_text, 3000), import INSERT OR IGNORE by PRAGMA columns. NOT done: Postgres (SQLite dialect everywhere; Turso enough), html code split (low value/risk).
- v3.1.0 (2026-11-25): English handling: ingest keeps English (zhRatio<0.2 of title+summary) only when AI+translate on, else drops (filter_english). translateStep now translates title (extra.zh) and summary (extra.zs), marker zv:2, retries 3 (zt). zhOnly() in fold.js used by snap shapeItems + mail digest/weekly: uses zs as summary, hides items with no CJK in zh/title/summary (hide_english default true). Settings translate_english, hide_english, source_suggest. Daily source suggestions: src/suggest.js (dailySuggest via crawl step suggest once/day meta suggest_day, rotating enabled category q, discoverSources; meta src_suggest max 30, src_ignored), GET/POST /api/admin/sources/suggest {run|added|ignore}; admin 数据源 header ★ 每日推荐 opens sync modal mode suggest.
- v3.2.0 (2026-11-25): user wants ALL English dropped, no translation. Ingest: filter_english drops if title has no CJK or zhRatio(title+summary+raw300)<0.2. zhOnly hides stored items whose original title has no CJK when filter_english on. Translate step now only matters for Chinese-title items with English summary, or when filter off.
- v3.3.0 (2026-11-25): same-target merge fixed. Bug: ingest matched existing items only on target, and fold used one key (target||url), so "TG post linking blog article" vs "the blog article itself (whose target is an external link)" never matched. Now items.ukey (targetKey(url)) column + idx; ingest matches candidate tkey/ukey against row target/ukey both ways; foldItems (fold.js, targetKey moved there, keyOf normalizes stored targets) folds on any shared key incl. sources urls; dedupStep (runs always; name keys only if ai_dedup) merges approved 14d by u|keys and backfills ukey. SCHEMA_VER 3.2.0.
- v3.4.0 (2026-11-25): autoOffSources in cleanupStep (source_auto_off; src_health last 3 days d>=3,f=0,e>=3 → enabled false + auto_off/auto_err on source; admin shows tag, re-enable clears). archive_days default 180: approved items kept (raw_text cleared after retention_days), others deleted at retention_days. GET /api/search?q= (gated, LIKE with ESCAPE, 80 rows, shapeItems) + public 「在归档里搜」 button. Admin batch review: POST /api/admin/items/batch {ids,status|delete}, checkbox per item, sticky bbar, keys j/k x a r p o Shift+A.
