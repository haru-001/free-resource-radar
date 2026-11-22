// Turso（libSQL，SQLite 兼容）适配层：对外提供和 Cloudflare D1 一样的接口
// prepare(sql).bind(...).first() / all() / run() / raw()，以及 batch([...])
// 走 Turso 的 HTTP 接口（/v2/pipeline），不依赖任何 npm 包
const toArg = (v) => {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
  if (typeof v === 'bigint') return { type: 'integer', value: v.toString() };
  if (typeof v === 'number') return Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
    const b = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return { type: 'blob', base64: btoa(s) };
  }
  return { type: 'text', value: String(v) };
};
const fromVal = (c) => {
  if (!c || c.type === 'null') return null;
  if (c.type === 'integer') { const n = Number(c.value); return Number.isSafeInteger(n) ? n : c.value; }
  if (c.type === 'float') return Number(c.value);
  if (c.type === 'blob') { const s = atob(c.base64 || ''); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b.buffer; }
  return c.value;
};

export function tursoD1(rawUrl, token) {
  const base = String(rawUrl || '').trim().replace(/^(libsql|turso):\/\//, 'https://').replace(/^wss?:\/\//, 'https://').replace(/\/+$/, '');
  const endpoint = base + '/v2/pipeline';
  async function pipeline(stmts) {
    const body = { requests: [...stmts.map((s) => ({ type: 'execute', stmt: { sql: s.sql, args: s.args.map(toArg) } })), { type: 'close' }] };
    let res;
    for (let attempt = 0; ; attempt++) {
      res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
      if (res.status >= 500 && attempt < 2) { await new Promise((r) => setTimeout(r, 300 * (attempt + 1))); continue; }
      break;
    }
    if (!res.ok) {
      const t = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`Turso 数据库请求失败 HTTP ${res.status}${res.status === 401 ? '（TURSO_AUTH_TOKEN 不对或已过期）' : ''}：${t}`);
    }
    const j = await res.json();
    return stmts.map((s, i) => {
      const r = j.results?.[i];
      if (!r || r.type === 'error') throw new Error('数据库错误：' + (r?.error?.message || '未知') + ' · SQL: ' + s.sql.slice(0, 120));
      const x = r.response?.result || {};
      const cols = (x.cols || []).map((c) => c.name);
      const rows = (x.rows || []).map((row) => row.map(fromVal));
      return { cols, rows, changes: x.affected_row_count || 0, last: x.last_insert_rowid == null ? null : Number(x.last_insert_rowid) };
    });
  }
  const objs = (r) => r.rows.map((row) => Object.fromEntries(r.cols.map((c, i) => [c, row[i]])));
  const meta = (r) => ({ changes: r.changes, last_row_id: r.last, rows_read: r.rows.length });
  function prepare(sql) {
    const st = {
      sql, args: [],
      bind(...a) { return Object.assign(Object.create(st), { sql, args: a }); },
      async first(col) { const [r] = await pipeline([this]); const o = objs(r)[0]; return o === undefined ? null : col ? o[col] ?? null : o; },
      async all() { const [r] = await pipeline([this]); return { results: objs(r), success: true, meta: meta(r) }; },
      async run() { const [r] = await pipeline([this]); return { results: objs(r), success: true, meta: meta(r) }; },
      async raw() { const [r] = await pipeline([this]); return r.rows; },
    };
    return st;
  }
  return {
    prepare,
    // D1 的 batch 是一个事务；这里也包在 BEGIN / COMMIT 里，一次网络往返
    async batch(list) {
      if (!list.length) return [];
      const stmts = [{ sql: 'BEGIN', args: [] }, ...list, { sql: 'COMMIT', args: [] }];
      try {
        const out = await pipeline(stmts);
        return out.slice(1, -1).map((r) => ({ results: objs(r), success: true, meta: meta(r) }));
      } catch (e) {
        // 管道里某条失败后服务器端事务已中止，连接随 close 释放，不需要再 ROLLBACK
        throw e;
      }
    },
    async exec(sql) { await pipeline(String(sql).split(/;\s*\n/).map((s) => s.trim()).filter(Boolean).map((s) => ({ sql: s, args: [] }))); return { count: 1 }; },
  };
}
