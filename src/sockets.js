// TCP / TLS 连接（Node.js），接口和 Cloudflare 的 connect() 一样：{ readable, writable, startTls(), close() }
// 只给 SMTP 用
import net from 'node:net';
import tls from 'node:tls';

function wrap(sock, hostname) {
  let ctrl = null, closed = false;
  const onData = (d) => { try { ctrl && ctrl.enqueue(new Uint8Array(d)); } catch {} };
  const onEnd = () => { if (!closed) { closed = true; try { ctrl && ctrl.close(); } catch {} } };
  const onErr = (e) => { if (!closed) { closed = true; try { ctrl && ctrl.error(e); } catch {} } };
  sock.on('data', onData); sock.on('end', onEnd); sock.on('close', onEnd); sock.on('error', onErr);
  const readable = new ReadableStream({ start(c) { ctrl = c; } });
  const writable = new WritableStream({
    write(chunk) { return new Promise((res, rej) => sock.write(chunk, (e) => (e ? rej(e) : res()))); },
  });
  return {
    readable, writable,
    startTls() {
      // 把明文连接交给 TLS：先摘掉这一层的监听，避免抢数据
      sock.removeListener('data', onData); sock.removeListener('end', onEnd); sock.removeListener('close', onEnd); sock.removeListener('error', onErr);
      closed = true;
      const t = tls.connect({ socket: sock, servername: hostname });
      t.setTimeout(30000, () => t.destroy(new Error('SMTP 连接超时')));
      return wrap(t, hostname);
    },
    async close() { try { sock.end(); } catch {} setTimeout(() => { try { sock.destroy(); } catch {} }, 500).unref?.(); },
  };
}

export function connect({ hostname, port }, opts = {}) {
  const sock = opts.secureTransport === 'on'
    ? tls.connect({ host: hostname, port, servername: hostname })
    : net.connect({ host: hostname, port });
  sock.setTimeout(30000, () => sock.destroy(new Error('SMTP 连接超时')));
  return wrap(sock, hostname);
}
