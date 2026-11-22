// 极简 SMTP 客户端（Node.js TCP / TLS）
// 支持 465（SSL 直连）与 587（STARTTLS），AUTH LOGIN。QQ 邮箱：smtp.qq.com:465 + 授权码
import { connect } from './sockets.js';

const enc = new TextEncoder();
const b64 = (str) => {
  const bytes = enc.encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

class Conn {
  constructor(socket) { this.attach(socket); }
  attach(socket) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
    this.dec = new TextDecoder();
    this.buf = '';
  }
  async write(s) { await this.writer.write(enc.encode(s)); }
  completeAt() {
    let pos = 0;
    for (;;) {
      const nl = this.buf.indexOf('\n', pos);
      if (nl < 0) return 0;
      const line = this.buf.slice(pos, nl).replace(/\r$/, '');
      if (/^\d{3}( |$)/.test(line)) return nl + 1; // 最后一行是 "250 xxx"，多行回复中间是 "250-xxx"
      pos = nl + 1;
    }
  }
  async reply(expect, step) {
    const deadline = Date.now() + 30000;
    for (;;) {
      const end = this.completeAt();
      if (end) {
        const block = this.buf.slice(0, end);
        this.buf = this.buf.slice(end);
        const code = parseInt(block.slice(block.lastIndexOf('\n', block.length - 2) + 1), 10) || parseInt(block, 10);
        if (expect && !expect.includes(code)) throw new Error(`SMTP ${step} 失败：${block.trim().slice(0, 200)}`);
        return { code, text: block };
      }
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`SMTP ${step} 超时`);
      const r = await Promise.race([
        this.reader.read(),
        new Promise((_, rej) => setTimeout(() => rej(new Error(`SMTP ${step} 超时`)), left)),
      ]);
      if (r.done) throw new Error(`SMTP 连接在 ${step} 时被关闭`);
      this.buf += this.dec.decode(r.value, { stream: true });
    }
  }
  async cmd(line, expect, step) { await this.write(line + '\r\n'); return this.reply(expect, step); }
  release() {
    try { this.reader.releaseLock(); } catch {}
    try { this.writer.releaseLock(); } catch {}
  }
}

/**
 * @param {object} o { host, port, secure: 'ssl'|'starttls', user, pass, from, to: string[], raw }
 */
export async function smtpSend(o) {
  const port = Number(o.port) || 465;
  const secure = o.secure || (port === 465 ? 'ssl' : 'starttls');
  const socket = connect({ hostname: o.host, port }, { secureTransport: secure === 'ssl' ? 'on' : 'starttls', allowHalfOpen: false });
  const c = new Conn(socket);
  const helo = 'radar.vercel.app';
  try {
    await c.reply([220], '握手');
    await c.cmd(`EHLO ${helo}`, [250], 'EHLO');
    if (secure === 'starttls') {
      await c.cmd('STARTTLS', [220], 'STARTTLS');
      c.release();
      c.attach(c.socket.startTls());
      await c.cmd(`EHLO ${helo}`, [250], 'EHLO(TLS)');
    }
    await c.cmd('AUTH LOGIN', [334], 'AUTH');
    await c.cmd(b64(o.user), [334], 'AUTH 用户名');
    await c.cmd(b64(o.pass), [235], 'AUTH 密码（QQ 邮箱请用授权码）');
    await c.cmd(`MAIL FROM:<${o.from}>`, [250], 'MAIL FROM');
    for (const addr of o.to) await c.cmd(`RCPT TO:<${addr}>`, [250, 251], `RCPT ${addr}`);
    await c.cmd('DATA', [354], 'DATA');
    const body = o.raw.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..'); // dot-stuffing
    await c.write(body + (body.endsWith('\r\n') ? '' : '\r\n') + '.\r\n');
    await c.reply([250], '发送内容');
    try { await c.cmd('QUIT', null, 'QUIT'); } catch {}
  } finally {
    try { await c.socket.close(); } catch {}
  }
}
