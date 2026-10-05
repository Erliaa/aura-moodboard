// Conversioni: HEIC -> JPG e video -> MP4 (H.264/AAC), quando Chromium non può leggere il file originale
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
function ffmpegPath() {
  try { const p = require('ffmpeg-static'); return p ? p.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1') : null; } catch { return null; }
}
function transcodeToMp4(src, dest) {
  return new Promise((resolve, reject) => {
    const ff = ffmpegPath(); if (!ff) return reject(new Error('ffmpeg non disponibile'));
    const args = ['-y', '-i', src, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', dest];
    const p = spawn(ff, args, { windowsHide: true }); let err = '';
    p.stderr.on('data', (d) => { err = (err + d).slice(-1500); }); p.on('error', reject);
    p.on('close', (c) => c === 0 ? resolve() : reject(new Error(err.slice(-300))));
  });
}
async function heicToJpg(src, dest) {
  const convert = require('heic-convert');
  const out = await convert({ buffer: await fs.promises.readFile(src), format: 'JPEG', quality: 0.92 });
  await fs.promises.writeFile(dest, Buffer.from(out));
}
module.exports = { transcodeToMp4, heicToJpg, ffmpegPath };
