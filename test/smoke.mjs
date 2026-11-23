// 冒烟测试：打包产物能加载，邮件 / 推送能渲染，规则函数正常。CI 和本地都能跑：node test/smoke.mjs
import assert from 'node:assert/strict';
import { renderDigest } from '../src/mailer.js';
import { isProxyTopic } from '../src/rules.js';

const mod = await import('../api/index.js');
assert.ok(mod.default || Object.keys(mod).length, 'api/index.js 没有导出');

const items = Array.from({ length: 6 }, (_, i) => ({ id: i, title: 'Free thing ' + i, url: 'https://e.com/' + i, category: i % 2 ? 'host' : 'domain', obtain: 'free', summary: '送 ' + i, score: 60 + i, extra: JSON.stringify(i === 0 ? { zh: '免费东西', project: 'https://github.com/a/b' } : {}) }));
const r = renderDigest(items, { mail_subject: '日报', mail_top_n: '3', mail_site_url: 'https://x.vercel.app' }, '2026-01-01');
const html = typeof r === 'string' ? r : r.html;
assert.ok(html.includes('今日精选'), '缺少今日精选');
assert.ok(html.includes('项目地址'), '缺少项目地址');
assert.ok(html.includes('免费东西'), '没用中文标题');
assert.equal(typeof isProxyTopic, 'function');
console.log('✓ 冒烟测试通过');
