// File di progetto .aura: uno zip (senza compressione) con project.json e la cartella media/
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
async function writeProject(dest, payload, files, libDir) {
  const archiver = require('archiver'), out = fs.createWriteStream(dest), ar = archiver('zip', { store: true });
  const done = new Promise((res, rej) => { out.on('close', res); out.on('error', rej); ar.on('error', rej); });
  ar.pipe(out); ar.append(JSON.stringify({ app: 'AURA moodboard', version: 1, ...payload }), { name: 'project.json' });
  for (const f of new Set(files)) { const fp = path.join(libDir, path.basename(f)); if (fs.existsSync(fp)) ar.file(fp, { name: 'media/' + path.basename(f) }); }
  await ar.finalize(); await done;
}
async function readProject(src, libDir) {
  const extract = require('extract-zip'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-'));
  try {
    await extract(src, { dir: tmp }); const j = JSON.parse(fs.readFileSync(path.join(tmp, 'project.json'), 'utf8'));
    if (j.app !== 'AURA moodboard') throw new Error('File non valido');
    const mdir = path.join(tmp, 'media'), map = {};
    if (fs.existsSync(mdir)) for (const f of fs.readdirSync(mdir)) {
      let name = f; if (fs.existsSync(path.join(libDir, name))) name = crypto.randomUUID() + path.extname(f);
      fs.copyFileSync(path.join(mdir, f), path.join(libDir, name)); map[f] = name;
    }
    return { data: j, map };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
module.exports = { writeProject, readProject };
