const { app, BrowserWindow, ipcMain, globalShortcut, dialog, protocol, net, shell, screen, session, Tray, Menu, nativeImage } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { serveFile } = require('./serve');
const { transcodeToMp4, heicToJpg } = require('./media');
const { writeProject, readProject } = require('./project');
let win, designMode = false, libDir, stateFile;
let dopts = { opacity: 1, dock: 'none', autohide: 0 }, prevBounds = null, tray = null, lastActive = Date.now(), updater = null;
const MEDIA_RE = /\.(png|jpe?g|webp|avif|gif|svg|heic|heif|mp4|mov|pdf)$/i;
const findProj = (argv) => (argv || []).find((a) => /\.aura$/i.test(a));
// Protocollo aura:// : serve i file della raccolta con CORS, così video e GIF si possono leggere (colori, export)
protocol.registerSchemesAsPrivileged([{ scheme: 'aura', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

function setDesignMode(on) {
  designMode = on;
  // 'screen-saver' mette la finestra sopra anche le app a schermo intero (senza bordi)
  win.setAlwaysOnTop(on, 'screen-saver');
  applyDesign();
  win.webContents.send('design-mode', on);
}
function initUpdater() { // aggiornamenti automatici (attivi solo nell'app installata e con un repository configurato)
  if (!app.isPackaged) return;
  try {
    const pub = (require('../../package.json').build || {}).publish, own = pub && pub[0] && pub[0].owner; if (!own || /TUO-UTENTE/i.test(own)) return;
    const { autoUpdater } = require('electron-updater'); autoUpdater.autoDownload = true; autoUpdater.autoInstallOnAppQuit = true; updater = autoUpdater;
    const send = (s, d) => win && win.webContents.send('update-status', { s, ...d });
    autoUpdater.on('update-available', (i) => send('available', { v: i.version })); autoUpdater.on('update-not-available', () => send('none', {}));
    autoUpdater.on('download-progress', (p) => send('progress', { p: Math.round(p.percent) })); autoUpdater.on('update-downloaded', (i) => send('ready', { v: i.version }));
    autoUpdater.on('error', (e) => send('error', { m: String((e && e.message) || e).slice(0, 160) })); autoUpdater.checkForUpdates().catch(() => {});
  } catch {}
}
function applyDesign() { // trasparenza e ancoraggio al bordo dello schermo (solo con modalità design attiva)
  if (!win) return;
  const restore = () => { if (prevBounds) { win.setMinimumSize(720, 480); win.setBounds(prevBounds); prevBounds = null; } };
  if (!designMode) { win.setOpacity(1); restore(); return; }
  win.setOpacity(Math.min(1, Math.max(.3, dopts.opacity)));
  if (dopts.dock === 'none') { restore(); return; }
  if (win.isMaximized()) win.unmaximize(); if (!prevBounds) prevBounds = win.getBounds();
  const wa = screen.getDisplayMatching(win.getBounds()).workArea, W = Math.round(wa.width * .3), Hh = Math.round(wa.height * .4);
  const b = { left: { x: wa.x, y: wa.y, width: W, height: wa.height }, right: { x: wa.x + wa.width - W, y: wa.y, width: W, height: wa.height }, top: { x: wa.x, y: wa.y, width: wa.width, height: Hh }, bottom: { x: wa.x, y: wa.y + wa.height - Hh, width: wa.width, height: Hh } }[dopts.dock];
  win.setMinimumSize(320, 220); win.setBounds(b);
}

const AUD = /\.(mp3|wav|flac|m4a|aac|ogg|opus)$/i;
async function importAudioPaths(ps) { // copia i brani (anche molto grandi) senza bloccare l'app e legge titolo, artista e copertina
  const out = []; let mm = null; try { mm = await import('music-metadata'); } catch {}
  for (const p of ps) {
    if (!AUD.test(p)) continue; const ext = path.extname(p).toLowerCase(), id = crypto.randomUUID(), dest = path.join(libDir, id + ext);
    await fs.promises.copyFile(p, dest); let title = path.basename(p, path.extname(p)), artist = '', cover = null;
    if (mm) { try {
      const m = await mm.parseFile(dest, { duration: false }); title = m.common.title || title; artist = m.common.artist || '';
      const pic = m.common.picture && m.common.picture[0]; if (pic) { cover = id + '-cover' + (/png/i.test(pic.format) ? '.png' : '.jpg'); fs.writeFileSync(path.join(libDir, cover), Buffer.from(pic.data)); }
    } catch {} }
    out.push({ id, file: id + ext, name: path.basename(p), title, artist, cover });
  }
  return out;
}
async function importPaths(ps) {
  const out = [];
  for (const p of ps) {
    if (!MEDIA_RE.test(p)) continue; const ext = path.extname(p).toLowerCase(), id = crypto.randomUUID(); let dest = id + ext, type = 'image';
    if (ext === '.heic' || ext === '.heif') { dest = id + '.jpg'; try { await heicToJpg(p, path.join(libDir, dest)); } catch { continue; } }
    else await fs.promises.copyFile(p, path.join(libDir, dest));
    if (ext === '.mp4' || ext === '.mov') type = 'video'; if (ext === '.pdf') type = 'pdf';
    out.push({ id, file: dest, name: path.basename(p), type });
  }
  return out;
}

// una sola istanza: se riapri l'app, torna in primo piano la finestra già aperta
if (!app.requestSingleInstanceLock()) { app.quit(); } else app.on('second-instance', (_e, argv) => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); const f = findProj(argv); if (f) win.webContents.send('open-project', f); } });
app.whenReady().then(() => {
  libDir = path.join(app.getPath('userData'), 'library');
  stateFile = path.join(app.getPath('userData'), 'state.json');
  fs.mkdirSync(libDir, { recursive: true });
  protocol.handle('aura', (req) => serveFile(libDir, req));

  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 720, minHeight: 480,
    frame: false, backgroundColor: '#0C0C0D', icon: path.join(__dirname, '../../assets/icon.png'), title: 'AURA moodboard',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), autoplayPolicy: 'no-user-gesture-required' }
  });
  // YouTube richiede un Referer per i video incorporati: la pagina locale (file://) non ne invia uno
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['https://www.youtube.com/*', 'https://www.youtube-nocookie.com/*'] }, (d, cb) => { d.requestHeaders['Referer'] = 'https://aura-moodboard.app/'; cb({ requestHeaders: d.requestHeaders }); });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  try { win.webContents.setVisualZoomLevelLimits(1, 1); } catch {}

  win.webContents.on('did-finish-load', () => { const f = findProj(process.argv); if (f) win.webContents.send('open-project', f); });
  const toggleVisible = () => { if (!win) return; if (win.isVisible() && !win.isMinimized()) win.hide(); else { win.show(); win.focus(); } lastActive = Date.now(); };
  globalShortcut.register('Control+Alt+H', toggleVisible);
  try {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, '../../assets/icon.png')).resize({ width: 16, height: 16 })); tray.setToolTip('AURA moodboard'); tray.on('click', toggleVisible);
    tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Mostra / nascondi', click: toggleVisible }, { label: 'Modalità design', click: () => setDesignMode(!designMode) }, { type: 'separator' }, { label: 'Esci', click: () => app.quit() }]));
  } catch {}
  setInterval(() => { // in modalità design, nasconde la finestra se non la usi
    if (!win || !designMode || !dopts.autohide || !win.isVisible()) return;
    const c = screen.getCursorScreenPoint(), b = win.getBounds(), inside = c.x >= b.x && c.x <= b.x + b.width && c.y >= b.y && c.y <= b.y + b.height;
    if (inside || win.isFocused()) { lastActive = Date.now(); return; } if (Date.now() - lastActive > dopts.autohide * 1000) win.hide();
  }, 1000);
  setTimeout(initUpdater, 4000);
  ipcMain.on('win', (_e, a) => {
    if (a === 'min') win.minimize();
    if (a === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
    if (a === 'close') win.close();
  });
  ipcMain.on('link:open', (_e, u) => { try { const p = new URL(u); if (p.protocol === 'http:' || p.protocol === 'https:') shell.openExternal(u); } catch {} });
  ipcMain.on('win:fullscreen', (_e, v) => { if (win) win.setFullScreen(!!v); });
  ipcMain.on('toggle-design', () => setDesignMode(!designMode));
  globalShortcut.register('Control+Alt+D', () => setDesignMode(!designMode));

  ipcMain.handle('state:load', () => {
    let s = null;
    try { s = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
    return { state: s, libDir };
  });
  ipcMain.on('state:save', (_e, s) => {
    const tmp = stateFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(s));
    fs.renameSync(tmp, stateFile);
  });
  ipcMain.handle('files:pick', async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Immagini, video e PDF', extensions: ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg', 'heic', 'heif', 'mp4', 'mov', 'pdf'] }]
    });
    return r.canceled ? [] : importPaths(r.filePaths);
  });
  ipcMain.handle('files:buffer', async (_e, name, bytes) => {
    const ext = path.extname(name).toLowerCase(); if (!MEDIA_RE.test(name)) return [];
    const tmp = path.join(os.tmpdir(), 'aura-' + crypto.randomUUID() + ext); fs.writeFileSync(tmp, Buffer.from(bytes));
    try { const r = await importPaths([tmp]); r.forEach((e) => { e.name = name; }); return r; } finally { fs.rmSync(tmp, { force: true }); }
  });
  ipcMain.handle('export:video', async (_e, bytes, ext) => {
    const r = await dialog.showSaveDialog(win, { defaultPath: 'moodboard.' + ext, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (r.canceled) return false;
    fs.writeFileSync(r.filePath, Buffer.from(bytes)); return true;
  });
  ipcMain.on('design:opts', (_e, o) => { if (o && typeof o.opacity === 'number') dopts = { opacity: o.opacity, dock: ['left', 'right', 'top', 'bottom'].includes(o.dock) ? o.dock : 'none', autohide: [10, 30, 60].includes(o.autohide) ? o.autohide : 0 }; applyDesign(); });
  ipcMain.handle('files:url', async (_e, u) => {
    try {
      const p = new URL(u); if (!/^https?:$/.test(p.protocol)) return [];
      const r = await net.fetch(u); if (!r.ok) return [];
      const map = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/avif': '.avif', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'video/mp4': '.mp4', 'video/quicktime': '.mov' };
      const ext = map[(r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()]; if (!ext) return [];
      const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 300e6) return [];
      const id = crypto.randomUUID(); fs.writeFileSync(path.join(libDir, id + ext), buf);
      return [{ id, file: id + ext, name: path.basename(p.pathname) || 'web' + ext, type: ext === '.mp4' || ext === '.mov' ? 'video' : 'image' }];
    } catch { return []; }
  });
  ipcMain.handle('export:text', async (_e, name, ext, text) => {
    const r = await dialog.showSaveDialog(win, { defaultPath: name + '.' + ext, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (r.canceled) return false; fs.writeFileSync(r.filePath, text, 'utf8'); return true;
  });
  ipcMain.handle('export:pdf', async (_e, dataUrl, w, h) => {
    const r = await dialog.showSaveDialog(win, { defaultPath: 'moodboard.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] }); if (r.canceled) return false;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-')), png = path.join(dir, 'p.png'), html = path.join(dir, 'p.html');
    fs.writeFileSync(png, Buffer.from(dataUrl.split(',')[1], 'base64'));
    fs.writeFileSync(html, `<html><style>@page{size:${w}px ${h}px;margin:0}html,body{margin:0}img{display:block;width:${w}px;height:${h}px}</style><body><img src="p.png"></body></html>`);
    const pw = new BrowserWindow({ show: false }); await pw.loadFile(html);
    const pdf = await pw.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true }); pw.destroy();
    fs.writeFileSync(r.filePath, pdf); fs.rmSync(dir, { recursive: true, force: true }); return true;
  });
  ipcMain.handle('export:originals', async (_e, list) => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] }); if (r.canceled) return 0;
    const out = r.filePaths[0], used = new Set(); let n = 0;
    for (const { file, name } of list) {
      const base = path.basename(name || file), e = path.extname(base); let t = base, i = 1;
      while (used.has(t.toLowerCase()) || fs.existsSync(path.join(out, t))) t = path.basename(base, e) + ' (' + (i++) + ')' + e;
      used.add(t.toLowerCase()); try { fs.copyFileSync(path.join(libDir, path.basename(file)), path.join(out, t)); n++; } catch {}
    }
    return n;
  });
  ipcMain.handle('audio:pick', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'opus'] }] });
    return r.canceled ? [] : importAudioPaths(r.filePaths);
  });
  ipcMain.handle('audio:import', (_e, ps) => importAudioPaths(ps));
  ipcMain.handle('meta:link', async (_e, u) => {
    try {
      const p = new URL(u), yt = /(^|\.)youtube\.com$|^youtu\.be$/.test(p.hostname), sp = p.hostname === 'open.spotify.com'; if (!yt && !sp) return null;
      const r = await net.fetch((yt ? 'https://www.youtube.com/oembed?format=json&url=' : 'https://open.spotify.com/oembed?url=') + encodeURIComponent(u)); if (!r.ok) return null;
      const j = await r.json(); let cover = null;
      if (j.thumbnail_url) { try { const tr = await net.fetch(j.thumbnail_url); if (tr.ok) { cover = crypto.randomUUID() + '-cover' + (/png/.test(tr.headers.get('content-type') || '') ? '.png' : '.jpg'); fs.writeFileSync(path.join(libDir, cover), Buffer.from(await tr.arrayBuffer())); } } catch {} }
      return { title: j.title || '', author: j.author_name || '', cover };
    } catch { return null; }
  });
  ipcMain.handle('video:transcode', async (_e, file) => {
    try {
      const src = path.join(libDir, path.basename(file)), name = crypto.randomUUID() + '.mp4';
      await transcodeToMp4(src, path.join(libDir, name)); fs.rmSync(src, { force: true }); return name;
    } catch { return null; }
  });
  ipcMain.handle('project:export', async (_e, payload, files, name) => {
    const r = await dialog.showSaveDialog(win, { defaultPath: (name || 'progetto').replace(/[\\/:*?"<>|]/g, '_') + '.aura', filters: [{ name: 'Progetto AURA', extensions: ['aura'] }] });
    if (r.canceled) return false; await writeProject(r.filePath, payload, files, libDir); return true;
  });
  ipcMain.handle('project:import', async (_e, p) => {
    let fp = p; if (!fp) { const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Progetto AURA', extensions: ['aura'] }] }); if (r.canceled) return null; fp = r.filePaths[0]; }
    try { return await readProject(fp, libDir); } catch { return { error: 'File di progetto non valido' }; }
  });
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('update:check', async () => { if (!updater) return { s: 'disabled' }; try { await updater.checkForUpdates(); return { s: 'checking' }; } catch { return { s: 'error' }; } });
  ipcMain.on('update:install', () => { if (updater) updater.quitAndInstall(); });
  ipcMain.handle('files:import', (_e, ps) => importPaths(ps));
  ipcMain.handle('file:read', (_e, f) => fs.readFileSync(path.join(libDir, path.basename(f))));
  ipcMain.on('file:delete', (_e, f) => { try { fs.unlinkSync(path.join(libDir, path.basename(f))); } catch {} });
  ipcMain.handle('export:save', async (_e, dataUrl) => {
    const r = await dialog.showSaveDialog(win, { defaultPath: 'moodboard.png', filters: [{ name: 'PNG', extensions: ['png'] }] });
    if (r.canceled) return false;
    fs.writeFileSync(r.filePath, Buffer.from(dataUrl.split(',')[1], 'base64'));
    return true;
  });
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
