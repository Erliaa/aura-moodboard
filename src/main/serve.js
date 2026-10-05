// Serve i file della raccolta (immagini, video, audio) con supporto agli intervalli di byte (Range):
// indispensabile per spostarsi in file molto grandi o in brani lunghi senza caricarli in memoria.
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const MIMES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.mp4': 'video/mp4', '.mov': 'video/mp4', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.opus': 'audio/ogg' };
async function serveFile(libDir, req) {
  const f = path.basename(decodeURIComponent(new URL(req.url).pathname)), fp = path.join(libDir, f);
  let st; try { st = await fs.promises.stat(fp); } catch { return new Response('Not found', { status: 404 }); }
  const h = { 'Content-Type': MIMES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' };
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (m && (m[1] || m[2])) {
    const start = m[1] ? +m[1] : Math.max(0, st.size - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
    if (start > end || start >= st.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${st.size}` } });
    h['Content-Range'] = `bytes ${start}-${end}/${st.size}`; h['Content-Length'] = String(end - start + 1);
    return new Response(Readable.toWeb(fs.createReadStream(fp, { start, end })), { status: 206, headers: h });
  }
  h['Content-Length'] = String(st.size);
  return new Response(Readable.toWeb(fs.createReadStream(fp)), { status: 200, headers: h });
}
module.exports = { serveFile };
