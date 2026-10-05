/* Touch/penna: i gesti si chiudono anche con pointercancel (il browser lo invia quando prende il controllo del tocco).
   Ogni ascoltatore { once } di pointerup viene registrato anche su pointercancel e rimosso da entrambi. */
(() => {
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (type === 'pointerup' && typeof fn === 'function' && opts && typeof opts === 'object' && opts.once) {
      const self = this, w = function (e) { self.removeEventListener('pointerup', w); self.removeEventListener('pointercancel', w); return fn.call(this, e); };
      add.call(this, 'pointerup', w); add.call(this, 'pointercancel', w); return;
    }
    return add.call(this, type, fn, opts);
  };
})();
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', svg: 'image/svg+xml', mp4: 'video/mp4', mov: 'video/mp4' };
const EXT = /\.(png|jpe?g|webp|avif|gif|svg|heic|heif|mp4|mov|pdf)$/i;
const BASE = '#0C0C0D';
const NOTE_COLORS = ['#FEE685', '#FFB4A8', '#A8E6CF', '#A8D8FF', '#D9C2FF', '#E3E3E3'];
const ICON_CHOICES = ['canvas', 'image', 'note', 'palette', 'align', 'design', 'file', 'folder', 'export', 'layers', 'collections'];
const KIND = { ph: 'Segnaposto', img: 'Immagine', note: 'Nota', text: 'Testo', shape: 'Forma', color: 'Blocco colore', line: 'Linea', link: 'Link', frame: 'Riquadro', path: 'Tracciato' };
const DEF = {
  text: { kind: 'text', w: 260, h: 70, text: 'Testo', fs: 28, color: '#D9D9D9' },
  rect: { kind: 'shape', shape: 'rect', w: 200, h: 140, color: '#2A2A2C' },
  ellipse: { kind: 'shape', shape: 'ellipse', w: 180, h: 180, color: '#2A2A2C' },
  line: { kind: 'line', w: 240, h: 24, color: '#E3E3E3', arrow: false },
  arrow: { kind: 'line', w: 240, h: 24, color: '#E3E3E3', arrow: true },
  color: { kind: 'color', w: 160, h: 160, color: '#1660FF' },
  link: { kind: 'link', w: 260, h: 84, url: '' },
  frame: { kind: 'frame', w: 480, h: 320, text: 'Riquadro', color: '#FFFFFF' }
};

let S = { library: [], folders: [], canvases: [], last: null, templates: [], design: { opacity: 1, compact: false, dock: 'none', autohide: 0 }, settings: { theme: 'dark', accent: 'auto', perf: false } };
let view = 'home', openId = null, sel = [], popKind = null, saveT, spaceDown = false, clip = [], pasteN = 0;
const cur = { home: null, library: null };
let cropId = null, phTarget = null; const q = { home: '', library: '', fav: false, hue: '' };

const save = () => { clearTimeout(saveT); saveT = setTimeout(() => aura.save(S), 250); };
const fileUrl = (f) => 'aura://lib/' + encodeURIComponent(f);
const lib = (id) => S.library.find((l) => l.id === id);
const curCanvas = () => S.canvases.find((c) => c.id === openId);
const stage = () => $('#stage'), world = () => $('#world');
const vw = () => { const c = curCanvas(); return c.view || (c.view = { x: 0, y: 0, z: 1 }); };
const itemOf = (id) => curCanvas()?.items.find((i) => i.id === id);
const selItems = () => curCanvas().items.filter((i) => sel.includes(i.id));
const elOf = (id) => $(`.it[data-id="${id}"]`, stage());
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), 2400); };
const editing = () => { const a = document.activeElement; return a && (a.isContentEditable || a.tagName === 'INPUT' || a.tagName === 'SELECT'); };
const isAnim = (en) => en && (en.type === 'video' || /\.gif$/i.test(en.file));
const contrast = (h) => ((parseInt(h.slice(1, 3), 16) * 299 + parseInt(h.slice(3, 5), 16) * 587 + parseInt(h.slice(5, 7), 16) * 114) / 1000 > 150 ? '#111' : '#fff');
const HEX = /^#?[0-9a-f]{6}$/i;
function normUrl(u) { u = u.trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; try { new URL(u); return u; } catch { return ''; } }
function itemBox(it) {
  const a = it.rot * Math.PI / 180, cx = it.x + it.w / 2, cy = it.y + it.h / 2, co = Math.abs(Math.cos(a)), si = Math.abs(Math.sin(a)), w = it.w * co + it.h * si, h = it.w * si + it.h * co;
  return { x: cx - w / 2, y: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2 };
}

/* ---------- Cronologia (annulla / ripristina) ---------- */
const HIST = new Map(); const snap = (c) => JSON.stringify({ items: c.items, bg: c.bg });
const H = (c) => { if (!HIST.has(c.id)) HIST.set(c.id, { undo: [], redo: [], last: snap(c) }); return HIST.get(c.id); };
function commit() {
  const c = curCanvas();
  if (c) { const h = H(c), s = snap(c); if (s !== h.last) { h.undo.push(h.last); if (h.undo.length > 100) h.undo.shift(); h.last = s; h.redo = []; } }
  save();
}
const commitSoon = (() => { let t; return () => { clearTimeout(t); t = setTimeout(commit, 500); }; })();
function restore(s) { const c = curCanvas(), o = JSON.parse(s); c.items = o.items; c.bg = o.bg; closePop(); renderCanvas(); save(); }
function undo() { const h = H(curCanvas()); if (!h.undo.length) return toast('Niente da annullare'); h.redo.push(h.last); h.last = h.undo.pop(); restore(h.last); }
function redo() { const h = H(curCanvas()); if (!h.redo.length) return toast('Niente da ripristinare'); h.undo.push(h.last); h.last = h.redo.pop(); restore(h.last); }

/* ---------- Colori e importazione ---------- */
function colorsOf(d) {
  let r = 0, g = 0, b = 0, w = 0;
  for (let i = 0; i < d.length; i += 4) {
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]), k = ((mx - mn) / 255) ** 1.5 * (mx / 255) + 0.02;
    r += d[i] * k; g += d[i + 1] * k; b += d[i + 2] * k; w += k;
  }
  const a = [r / w, g / w, b / w]; let r2 = 0, g2 = 0, b2 = 0, w2 = 0;
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.hypot(d[i] - a[0], d[i + 1] - a[1], d[i + 2] - a[2]) / 441, mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    const k = dist * dist * ((mx - mn) / 255 + .1) * (mx / 255 + .1) + .001; r2 += d[i] * k; g2 += d[i + 1] * k; b2 += d[i + 2] * k; w2 += k;
  }
  const h = (v) => Math.round(v).toString(16).padStart(2, '0');
  return ['#' + a.map(h).join(''), '#' + [r2 / w2, g2 / w2, b2 / w2].map(h).join('')];
}
const imgCache = new Map();
async function imgOf(file) {
  if (!imgCache.has(file)) {
    const bytes = await aura.read(file), im = new Image();
    im.src = URL.createObjectURL(new Blob([bytes], { type: MIME[file.split('.').pop().toLowerCase()] })); await im.decode(); imgCache.set(file, im);
  }
  return imgCache.get(file);
}
async function analyze(e) {
  try {
    if (e.type === 'video') {
      const v = document.createElement('video'); v.muted = true; v.crossOrigin = 'anonymous'; v.preload = 'auto';
      const load = (file) => new Promise((r) => { const t = setTimeout(() => r(false), 7000); v.onloadeddata = () => { clearTimeout(t); r(v.videoWidth > 0); }; v.onerror = () => { clearTimeout(t); r(false); }; v.src = fileUrl(file); });
      let ok = await load(e.file);
      if (!ok) { toast('Converto il video in MP4…'); const nf = await aura.transcode(e.file); if (nf) { e.file = nf; ok = await load(nf); } }
      e.nw = v.videoWidth || 16; e.nh = v.videoHeight || 9;
      if (ok) { try { const c = document.createElement('canvas'); c.width = c.height = 24; const x = c.getContext('2d'); x.drawImage(v, 0, 0, 24, 24); [e.color, e.color2] = colorsOf(x.getImageData(0, 0, 24, 24).data); } catch {} }
      return e;
    }
    const im = await imgOf(e.file); e.nw = im.naturalWidth || 512; e.nh = im.naturalHeight || 512;
    const c = document.createElement('canvas'); c.width = c.height = 24; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 24, 24);
    [e.color, e.color2] = colorsOf(x.getImageData(0, 0, 24, 24).data);
  } catch { e.nw = e.nw || 4; e.nh = e.nh || 3; }
  return e;
}
async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'vendor/pdf.min.js'; sc.onload = res; sc.onerror = rej; document.head.append(sc); });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; return window.pdfjsLib;
}
async function convertPdf(e) { // ogni pagina (fino a 20) diventa un'immagine nella Raccolta
  const out = [];
  try {
    const pdfjs = await loadPdfJs(), doc = await pdfjs.getDocument({ data: await aura.read(e.file) }).promise, n = Math.min(doc.numPages, 20), base = e.name.replace(/\.pdf$/i, '');
    if (doc.numPages > 20) toast('PDF di ' + doc.numPages + ' pagine: importo le prime 20');
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i), v1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: Math.min(3, 2400 / Math.max(v1.width, v1.height)) });
      const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: cx, viewport: vp }).promise;
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      out.push(...await aura.importBuffer(`${base}${n > 1 ? ' p' + i : ''}.png`, new Uint8Array(await blob.arrayBuffer())));
    }
  } catch { toast('Impossibile leggere il PDF'); }
  aura.del(e.file); return out;
}
async function ingest(entries, folderId) {
  const out = [];
  for (const e of entries) {
    const list = e.type === 'pdf' ? await convertPdf(e) : [e];
    for (const x of list) { await analyze(x); x.folderId = folderId ?? null; S.library.push(x); out.push(x); }
  }
  save(); return out;
}
async function importDropped(list) {
  list = [...list].filter((f) => !/\.aura$/i.test(f.name));
  const ext = (f) => EXT.test(f.name) ? f.name : (/^image\/(png|jpe?g|webp|avif|gif)$/.test(f.type) ? f.name + '.' + f.type.split('/')[1].replace('jpeg', 'jpg') : f.type === 'image/svg+xml' ? f.name + '.svg' : /^image\/hei[cf]$/.test(f.type) ? f.name + '.heic' : f.type === 'video/mp4' ? f.name + '.mp4' : f.type === 'video/quicktime' ? f.name + '.mov' : f.type === 'application/pdf' ? f.name + '.pdf' : null);
  const files = list.map((f) => ({ f, n: ext(f) })).filter((o) => o.n); if (!files.length) { if (list.length) toast('Formato non supportato'); return []; }
  const paths = [], bufs = [];
  for (const { f, n } of files) { let p = ''; try { p = aura.pathOf(f); } catch {} p && EXT.test(p) ? paths.push(p) : bufs.push({ f, n }); }
  if (files.length) toast('Importo ' + files.length + (files.length === 1 ? ' file…' : ' file…'));
  const out = paths.length ? await aura.importFiles(paths) : [];
  for (const { f, n } of bufs) out.push(...await aura.importBuffer(n, new Uint8Array(await f.arrayBuffer())));
  return out;
}

/* ---------- Utilità UI ---------- */
function rename(lbl, val, commitFn) {
  const i = document.createElement('input'); i.value = val; i.maxLength = 25; i.className = 'ren'; if (lbl.id === 'title') i.id = 'title-ren';
  lbl.replaceWith(i); i.focus(); i.select(); let done = false;
  const end = (ok) => { if (done) return; done = true; const v = i.value.trim().slice(0, 25); if (ok && v) commitFn(v); setView(view); };
  i.onkeydown = (e) => { if (e.key === 'Enter') end(true); if (e.key === 'Escape') end(false); e.stopPropagation(); };
  i.onblur = () => end(true); i.onclick = (e) => e.stopPropagation();
}
function menu(e, items) {
  e.preventDefault(); const m = $('#ctx'); m.innerHTML = '';
  items.forEach((row) => {
    if (!row) { const s = document.createElement('i'); s.className = 'sep'; m.append(s); return; }
    const [t, f, hint, on] = row; const b = document.createElement('button');
    if (hint !== undefined || on !== undefined) { b.classList.add('ctxit'); if (on !== undefined) b.classList.add('chk'); if (on) b.classList.add('on'); b.innerHTML = `<span>${t}</span>${hint ? `<small>${hint}</small>` : ''}`; }
    else b.textContent = t;
    b.onclick = () => { m.classList.add('hidden'); f(); }; m.append(b);
  });
  m.classList.remove('hidden'); m.style.left = Math.min(e.clientX, innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = Math.min(e.clientY, innerHeight - m.offsetHeight - 8) + 'px';
}
function dropTarget(el, fn) {
  el.ondragover = (e) => { if (e.dataTransfer.types.includes('text/aura')) { e.preventDefault(); el.classList.add('over'); } };
  el.ondragleave = () => el.classList.remove('over');
  el.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); el.classList.remove('over'); const raw = e.dataTransfer.getData('text/aura'); if (raw) fn(JSON.parse(raw)); };
}
function move(d, folderId) { const o = d.kind === 'canvas' ? S.canvases.find((c) => c.id === d.id) : lib(d.id); if (o) { o.folderId = folderId; save(); setView(view); } }
const mediaEl = (e) => e.type === 'video'
  ? `<video src="${fileUrl(e.file)}" crossorigin="anonymous" muted loop autoplay playsinline></video>` : `<img src="${fileUrl(e.file)}" crossorigin="anonymous" draggable="false">`;

/* ---------- Home e Raccolta ---------- */
function welcomePage() {
  const w = document.createElement('div'); w.className = 'welcome';
  const tips = [['Trascina', 'Trascina immagini e video da Esplora risorse direttamente sul canvas'], ['Tasto destro', 'Il menu rapido ha tutte le scorciatoie e le impostazioni'], ['Maiusc + 1…9', 'Passa da un canvas all’altro con il suo numero'], ['Maiusc + W', 'Avvia la presentazione, per riquadri o immagine per immagine'], ['Tasto P', 'La penna per disegnare forme; doppio clic su una forma per modificarne i punti'], ['Ctrl + U', 'Guide automatiche per allineare mentre sposti']];
  w.innerHTML = `<div class="wl-mark">${icon('canvas', 56)}</div><h1>Benvenuto in <span>AURA</span></h1>
    <p>Il tuo spazio per costruire moodboard: raccogli immagini, video e idee su una tavola infinita, allinea tutto con precisione e presenta il risultato.</p>
    <div class="wl-act"><button class="go" id="w-new">${icon('canvas', 22)}Crea il tuo primo canvas</button><button class="wl-b" id="w-img">${icon('image', 20)}Aggiungi immagini</button><button class="wl-b" id="w-open">${icon('file', 20)}Apri un progetto (.aura)</button></div>
    <div class="wl-tips">${tips.map(([t, d]) => `<div><b>${t}</b><span>${d}</span></div>`).join('')}</div>
    <small>Con il touch: due dita per spostare e zoomare il canvas, doppio tocco per modificare un elemento.</small>`;
  $('#w-new', w).onclick = () => newCanvas(); $('#w-img', w).onclick = () => { setView('library'); addFiles(); }; $('#w-open', w).onclick = () => importProjectFile(null);
  return w;
}

const matches = (o, t) => { t = (t || '').trim().toLowerCase(); return !t || [o.name, (o.tags || []).join(' '), o.desc || ''].join(' ').toLowerCase().includes(t); };
const favFirst = (a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0);
const badges = (o) => (o.color ? `<i class="lc" style="background:${o.color}"></i>` : '') + (o.fav ? `<span class="fv">${icon('star_fill1', 16)}</span>` : '') + (o.tags && o.tags.length ? `<span class="tg">${esc(o.tags.slice(0, 2).join(' · '))}</span>` : '');
function renderGrid(scope, keep) {
  const el = $('#' + scope); el.innerHTML = ''; el.classList.toggle('noanim', !!keep); const inF = cur[scope], qq = q[scope], searching = !!qq.trim() || (scope === 'home' && q.fav) || (scope === 'library' && !!q.hue); let n = 0;
  if (scope === 'home' && !inF && !searching && !S.canvases.length && !S.folders.some((f) => f.scope === 'home')) { el.append(welcomePage()); return; }
  const sr = document.createElement('div'); sr.className = 'srow';
  sr.innerHTML = `${icon('search', 18)}<input type="text" id="q-${scope}" placeholder="${scope === 'home' ? 'Cerca canvas, cartelle, tag…' : 'Cerca per nome o tag…'}" value="${esc(qq)}">` + (scope === 'home' ? `<button class="chip ${q.fav ? 'on' : ''}" id="q-fav">${icon(q.fav ? 'star_fill1' : 'star', 16)}Preferiti</button>` : '') + (scope === 'library' ? hueChips() : '');
  el.append(sr);
  const qi = $('#q-' + scope); qi.oninput = () => { q[scope] = qi.value; const pos = qi.selectionStart; renderGrid(scope, true); const ni = $('#q-' + scope); ni.focus(); ni.setSelectionRange(pos, pos); };
  if (scope === 'home') $('#q-fav').onclick = () => { q.fav = !q.fav; renderGrid(scope, true); };
  if (scope === 'library') el.querySelectorAll('.hues b').forEach((b) => b.onclick = () => { q.hue = q.hue === b.dataset.h ? '' : b.dataset.h; renderGrid(scope, true); });
  const add = (html, cls, fn) => { const d = document.createElement('div'); d.className = 'card ' + cls; d.innerHTML = html; d.style.setProperty('--i', Math.min(n++, 14)); if (fn) d.onclick = fn; el.append(d); return d; };
  if (scope === 'home') add(icon('canvas', 64) + '<u>Crea Canvas</u>', 'action', (e) => {
    if (!S.templates.length) return newCanvas(); e.stopPropagation();
    menu(e, [['Canvas vuoto', () => newCanvas()], ...S.templates.map((t) => ['Da modello: ' + t.name, () => newCanvas(t)]), ['Gestisci modelli…', templatesModal]]);
  }); else add(icon('file', 64) + '<u>Aggiungi File</u>', 'action', addFiles);
  add(icon('folderAdd', 64) + '<u>Crea Cartella</u>', 'action', () => newFolder(scope));
  if (inF && !searching) {
    const f = S.folders.find((x) => x.id === inF);
    const b = add(icon('back', 64) + `<u>${esc(f ? f.name : 'Indietro')}</u>`, 'action', () => { cur[scope] = null; renderGrid(scope); });
    dropTarget(b, (d) => move(d, null));
  }
  if (scope === 'home') el.append(document.createElement('hr'));
  S.folders.filter((f) => f.scope === scope && (searching ? matches(f, qq) && (!q.fav || f.fav) : !inF)).sort(favFirst).forEach((f) => {
    const d = add(badges(f) + icon('folder', 72) + `<u class="lbl">${esc(f.name)}</u>`, 'folder', () => { cur[scope] = f.id; q[scope] = ''; renderGrid(scope); });
    d.dataset.fid = f.id; dropTarget(d, (x) => move(x, f.id));
    d.oncontextmenu = (e) => menu(e, [
      ['Rinomina', () => rename($('.lbl', d), f.name, (v) => { f.name = v; save(); })],
      [f.fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti', () => { f.fav = !f.fav; save(); setView(view); }],
      ['Tag e colore…', () => metaModal(f, false)],
      ['Elimina cartella', () => { if (confirm('Eliminare la cartella? Il contenuto resta disponibile.')) { S[scope === 'home' ? 'canvases' : 'library'].forEach((o) => { if (o.folderId === f.id) o.folderId = null; }); S.folders = S.folders.filter((x) => x !== f); save(); setView(view); } }]]);
  });
  if (scope === 'home') {
    S.canvases.filter((c) => searching ? matches(c, qq) && (!q.fav || c.fav) : (c.folderId ?? null) === inF).sort(favFirst).forEach((c) => {
      const ic = c.icon, cv = ic && ic.type === 'lib' && lib(ic.id);
      let mid = `<span class="count">${c.items.length}</span>`; if (ic && ic.type === 'icon') mid = icon(ic.name, 72);
      const d = add(numBadge(c) + badges(c) + (cv ? `<div class="cover">${mediaEl(cv)}</div>` : '') + mid + `<u class="lbl">${esc(c.name)}</u>`, 'cv' + (cv ? ' hasc' : ''), () => openCanvas(c.id));
      d.style.background = preview(c); d.draggable = true;
      d.ondragstart = (e) => e.dataTransfer.setData('text/aura', JSON.stringify({ kind: 'canvas', id: c.id }));
      d.oncontextmenu = (e) => menu(e, [
        ['Rinomina', () => rename($('.lbl', d), c.name, (v) => { c.name = v; save(); })], ['Cambia icona', () => iconModal(c)],
        [c.fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti', () => { c.fav = !c.fav; save(); setView(view); }],
        ['Tag, colore, descrizione…', () => metaModal(c, true)], ['Duplica', () => duplicateCanvas(c)], ['Salva come modello', () => saveTemplate(c)],
        ['Elimina canvas', () => { if (confirm('Eliminare questo canvas?')) { if (typeof releaseTracks === 'function') releaseTracks(c); S.canvases = S.canvases.filter((x) => x !== c); if (openId === c.id) openId = null; save(); setView('home'); } }]]);
    });
    el.ondragover = (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); };
    el.ondrop = async (e) => { const fl = [...e.dataTransfer.files]; if (!fl.length) return; e.preventDefault(); const en = await ingest(await importDropped(fl), null); if (en.length) toast(en.length + ' file aggiunti alla Raccolta'); };
  } else {
    S.library.filter((l) => searching ? libMatch(l, qq) : (l.folderId ?? null) === inF).sort(favFirst).forEach((l) => {
      const d = add(libBadges(l) + mediaEl(l), 'm'); d.draggable = true; d.title = l.name;
      d.ondragstart = (e) => e.dataTransfer.setData('text/aura', JSON.stringify({ kind: 'lib', id: l.id }));
      d.oncontextmenu = (e) => menu(e, [[l.fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti', () => { l.fav = !l.fav; save(); setView('library'); }], ['Tag e colore…', () => metaModal(l, false, 'lab')], ['Elimina dalla raccolta', () => {
        if (!confirm('Eliminare il file? Verrà tolto anche dai canvas.')) return;
        S.canvases.forEach((c) => { c.items = c.items.filter((i) => i.lib !== l.id); if (c.icon && c.icon.id === l.id) c.icon = null; });
        S.library = S.library.filter((x) => x !== l); aura.del(l.file); save(); setView('library');
      }]]);
    });
    el.ondragover = (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); };
    el.ondrop = async (e) => { const fl = [...e.dataTransfer.files]; if (!fl.length) return; e.preventDefault(); await ingest(await importDropped(fl), cur.library); renderGrid('library'); };
  }
}
function preview(c) {
  if (c.bg.mode === 'hex') return c.bg.hex;
  const cols = c.items.map((i) => i.kind === 'img' && lib(i.lib)?.color).filter(Boolean).slice(0, 3);
  return cols.length ? cols.map((k, i) => `radial-gradient(circle at ${[30, 70, 50][i]}% ${[30, 60, 85][i]}%, ${k}55, transparent 60%)`).join(',') + ',' + BASE : BASE;
}
function newCanvas(tpl) {
  const c = { id: uid(), name: tpl ? tpl.name.slice(0, 25) : 'Moodboard ' + (S.canvases.length + 1), folderId: cur.home, bg: tpl ? { ...tpl.bg } : { mode: 'auto', hex: BASE }, items: tpl ? tpl.items.map((i) => ({ ...clone(i), id: uid() })) : [], icon: null, view: { x: 0, y: 0, z: 1 } };
  S.canvases.push(c); save(); openCanvas(c.id);
}
function duplicateCanvas(c) { const n = clone(c); n.id = uid(); n.name = (c.name + ' copia').slice(0, 25); n.fav = false; n.items.forEach((i) => { i.id = uid(); }); S.canvases.push(n); save(); setView('home'); toast('Canvas duplicato'); }
function saveTemplate(c) {
  const items = c.items.map((i) => { const k = clone(i); k.id = uid(); return k.kind === 'img' ? { id: k.id, kind: 'ph', x: k.x, y: k.y, w: k.w, h: k.h, rot: k.rot, rad: k.rad, op: k.op, sh: k.sh } : k; });
  S.templates.push({ id: uid(), name: c.name, items, bg: { ...c.bg } }); save(); toast('Modello salvato: lo trovi in "Crea Canvas"');
}
function templatesModal() {
  const m = $('#modal'); m.innerHTML = `<div class="panel"><h3>Modelli</h3>${S.templates.length ? S.templates.map((t) => `<div class="tr"><span>${esc(t.name)}</span><button data-id="${t.id}">${icon('delete', 16)}Elimina</button></div>`).join('') : '<p>Nessun modello salvato.</p>'}<div class="acts"><button id="mclose">Chiudi</button></div></div>`;
  m.classList.remove('hidden'); m.querySelectorAll('.tr button').forEach((b) => b.onclick = () => { S.templates = S.templates.filter((t) => t.id !== b.dataset.id); save(); templatesModal(); });
  $('#mclose').onclick = () => m.classList.add('hidden'); m.onclick = (e) => { if (e.target === m) m.classList.add('hidden'); };
}
function metaModal(o, isC, key = 'color') {
  const m = $('#modal'), COLS = ['', ...NOTE_COLORS, '#1660FF', '#36DD33'];
  m.innerHTML = `<div class="panel"><h3>${esc(o.name)}</h3><p>Colore</p><div class="cl">${COLS.map((k) => `<b data-k="${k}" class="${(o[key] || '') === k ? 'on' : ''}" style="${k ? 'background:' + k : ''}">${k ? '' : '×'}</b>`).join('')}</div>
    <p>Tag (separati da virgola)</p><input class="ti" id="m-tags" maxlength="80" value="${esc((o.tags || []).join(', '))}">
    ${isC ? `<p>Descrizione</p><input class="ti" id="m-desc" maxlength="120" value="${esc(o.desc || '')}">` : ''}
    <label class="pr" style="margin-top:12px"><span>${icon('star', 16)}Preferito</span><input type="checkbox" id="m-fav" ${o.fav ? 'checked' : ''}></label><div class="acts"><button id="mok">Fatto</button></div></div>`;
  m.classList.remove('hidden'); let col = o[key] || '';
  m.querySelectorAll('.cl b').forEach((b) => b.onclick = () => { col = b.dataset.k; m.querySelectorAll('.cl b').forEach((x) => x.classList.toggle('on', x === b)); });
  const done = () => { o[key] = col || null; o.tags = $('#m-tags').value.split(',').map((t) => t.trim().slice(0, 16)).filter(Boolean).slice(0, 5); if (isC) o.desc = $('#m-desc').value.trim(); o.fav = $('#m-fav').checked; save(); m.classList.add('hidden'); setView(view); };
  $('#mok').onclick = done; m.onclick = (e) => { if (e.target === m) done(); };
}
const canvasOrder = () => [...S.canvases].sort(favFirst);
const numBadge = (c) => { const i = canvasOrder().indexOf(c); return i >= 0 && i < 9 ? `<em class="nb">${i + 1}</em>` : ''; };
function switchPop(btn) {
  const m = $('#swm'); if (!m.classList.contains('hidden')) { m.classList.add('hidden'); return; }
  m.innerHTML = `<input type="text" placeholder="Cerca canvas…"><div class="sl"></div><button class="nw">${icon('add', 16)}Nuovo canvas</button>`;
  const draw = (qs) => {
    const l = S.canvases.filter((c) => matches(c, qs)).sort(favFirst), box = $('.sl', m);
    box.innerHTML = l.map((c) => `<button data-id="${c.id}" class="${c.id === openId ? 'on' : ''}"><i style="background:${c.color || 'transparent'}"></i><span>${esc(c.name)}</span><em class="nb2">${canvasOrder().indexOf(c) < 9 ? canvasOrder().indexOf(c) + 1 : ''}</em>${c.fav ? icon('star_fill1', 14) : ''}</button>`).join('') || '<p>Nessun canvas</p>';
    box.querySelectorAll('button').forEach((b) => b.onclick = () => { m.classList.add('hidden'); openCanvas(b.dataset.id); });
  };
  const r = btn.getBoundingClientRect(); m.style.left = r.left + 'px'; m.style.top = r.bottom + 8 + 'px'; m.classList.remove('hidden'); draw('');
  const inp = $('input', m); inp.focus(); inp.oninput = () => draw(inp.value); inp.onkeydown = (e) => e.stopPropagation(); $('.nw', m).onclick = () => { m.classList.add('hidden'); newCanvas(); };
}
function editDesc(sp, c) {
  const i = document.createElement('input'); i.className = 'ren desc-in'; i.maxLength = 120; i.value = c.desc || ''; i.placeholder = 'Descrizione…'; sp.replaceWith(i); i.focus(); let done = false;
  const end = (ok) => { if (done) return; done = true; if (ok) { c.desc = i.value.trim(); save(); } setView(view); };
  i.onkeydown = (e) => { if (e.key === 'Enter') end(true); if (e.key === 'Escape') end(false); e.stopPropagation(); }; i.onblur = () => end(true);
}
function newFolder(scope) {
  const f = { id: uid(), name: 'Nuova cartella', scope }; S.folders.push(f); save(); cur[scope] = null; renderGrid(scope);
  const l = $(`#${scope} [data-fid="${f.id}"] .lbl`); if (l) rename(l, f.name, (v) => { f.name = v; save(); });
}
async function addFiles() { await ingest(await aura.pick(), cur.library); renderGrid('library'); }
function openCanvas(id) { openId = id; S.last = id; save(); setView('canvas'); }
function iconModal(c) {
  const m = $('#modal');
  m.innerHTML = `<div class="panel"><h3>Icona di “${esc(c.name)}”</h3>
    <div class="ig">${ICON_CHOICES.map((n) => `<button data-n="${n}" class="${c.icon?.name === n ? 'on' : ''}">${icon(n, 36)}</button>`).join('')}</div>
    ${S.library.length ? `<p>Oppure usa un’immagine della raccolta come copertina</p><div class="pk">${S.library.map((l) => `<div class="th" data-id="${l.id}">${mediaEl(l)}</div>`).join('')}</div>` : ''}
    <div class="acts"><button id="mdef">Numero di elementi</button><button id="mclose">Chiudi</button></div></div>`;
  m.classList.remove('hidden');
  const set = (v) => { c.icon = v; save(); m.classList.add('hidden'); if (view === 'home') renderGrid('home'); };
  m.querySelectorAll('.ig button').forEach((b) => b.onclick = () => set({ type: 'icon', name: b.dataset.n }));
  m.querySelectorAll('.th').forEach((t) => t.onclick = () => set({ type: 'lib', id: t.dataset.id }));
  $('#mdef').onclick = () => set(null); $('#mclose').onclick = () => m.classList.add('hidden'); m.onclick = (e) => { if (e.target === m) m.classList.add('hidden'); };
}

/* ---------- Elementi del canvas ---------- */
const capHtml = (it) => (it.cap && (it.cap.t || it.cap.d)) ? `<div class="cap">${it.cap.t ? `<b>${esc(it.cap.t)}</b>` : ''}${it.cap.d ? `<span>${esc(it.cap.d)}</span>` : ''}</div>` : '';
const cropOf = (it) => it.crop || { l: 0, t: 0, r: 0, b: 0 };
function cropWrap(it, inner) {
  if (!it.crop) return inner; const c = it.crop, fw = 1 - c.l - c.r, fh = 1 - c.t - c.b;
  return `<div class="cm" style="width:${100 / fw}%;height:${100 / fh}%;left:${-c.l / fw * 100}%;top:${-c.t / fh * 100}%">${inner}</div>`;
}
function fillIn(el, it) {
  let h = '', gh = '';
  if (it.kind === 'img') { const e = lib(it.lib); if (!e) return false; h = cropWrap(it, mediaEl(e)) + capHtml(it); if (cropId === it.id) gh = `<div class="ghost">${mediaEl(e)}</div>`; }
  else if (it.kind === 'ph') h = '<span>Segnaposto immagine<small>doppio clic per scegliere, o trascina qui un file</small></span>';
  else if (it.kind === 'note') h = `<div class="note" style="background:${it.color || NOTE_COLORS[0]}">${esc(it.text)}</div>`;
  else if (it.kind === 'text') h = `<div class="txt" style="color:${it.color};font-size:${it.fs}px">${esc(it.text)}</div>`;
  else if (it.kind === 'color') h = `<span class="hex" style="color:${contrast(it.color)}">${it.color.toUpperCase()}</span>`;
  else if (it.kind === 'line') h = `<i class="ln" style="background:${it.color};${it.arrow ? 'right:12px' : ''}"></i>${it.arrow ? `<i class="ah" style="border-left-color:${it.color}"></i>` : ''}`;
  else if (it.kind === 'link') { let d = it.url; try { d = new URL(it.url).hostname.replace(/^www\./, ''); } catch {} h = `<b>${esc(d)}</b><small>${esc(it.url)}</small>`; }
  else if (it.kind === 'path') h = pathSvg(it);
  else if (it.kind === 'frame') h = `<span class="flbl">${esc(it.text || '')}</span>`;
  el.innerHTML = `${gh}<div class="in k-${it.kind}">${h}</div>`; styleIn(el, it); el.classList.toggle('frame', it.kind === 'frame'); el.classList.toggle('pathk', it.kind === 'path'); if (it.kind === 'img' && typeof applyLv === 'function') applyLv(el, it); return true;
}
function styleIn(el, it) {
  const n = $('.in', el); if (!n) return;
  if (it.kind === 'shape' || it.kind === 'color') n.style.background = it.color;
  n.style.boxShadow = it.sh && it.kind !== 'line' ? '0 14px 40px rgba(0,0,0,.55)' : 'none'; el.style.opacity = it.op ?? 1;
  if (it.kind === 'path') n.style.filter = it.sh ? 'drop-shadow(0 14px 24px rgba(0,0,0,.55))' : '';
}
function applyTf(el, it) {
  el.style.left = it.x + 'px'; el.style.top = it.y + 'px'; el.style.width = it.w + 'px'; el.style.height = it.h + 'px'; el.style.transform = `rotate(${it.rot}deg)`;
  const n = $('.in', el); if (n && it.kind !== 'line' && it.kind !== 'path') n.style.borderRadius = it.shape === 'ellipse' ? '50%' : ((it.rad || 0) / 100 * Math.min(it.w, it.h)) + 'px';
  const g = $('.ghost', el); if (g) { const c = cropOf(it), fw = 1 - c.l - c.r, fh = 1 - c.t - c.b, mw = it.w / fw, mh = it.h / fh; Object.assign(g.style, { width: mw + 'px', height: mh + 'px', left: -c.l * mw + 'px', top: -c.t * mh + 'px' }); }
  if (it.kind === 'path') updatePathSvg(el, it);
}
function redrawAmb(it) { const d = $(`.amb[data-b="${it.id}"]`); if (d) drawAmb(d, it); }
function toggleCrop() { const it = sel.length === 1 && itemOf(sel[0]); if (!it || it.kind !== 'img') return; cropId = cropId === it.id ? null : it.id; refresh(it); renderProps(); }
function pickForPh(id) { closePop(); imagePop(); phTarget = id; }
function fillPlaceholder(ph, en) {
  ph.kind = 'img'; ph.lib = en.id; const far = ph.w / ph.h, iar = en.nw / en.nh, c = { l: 0, t: 0, r: 0, b: 0 };
  if (iar > far) c.l = c.r = (1 - far / iar) / 2; else c.t = c.b = (1 - iar / far) / 2; ph.crop = c; refresh(ph); updateBg(); select([ph.id]); commit();
}
function mkItem(it) { const el = document.createElement('div'); el.className = 'it'; el.dataset.id = it.id; if (!fillIn(el, it)) return null; applyTf(el, it); return el; }
function refresh(it) { const el = elOf(it.id); if (!el) return; fillIn(el, it); applyTf(el, it); addHandles(); }
function applyView() {
  const v = vw(), t = `translate(${v.x}px,${v.y}px) scale(${v.z})`; world().style.transform = t; $('#bgl').style.transform = t;
  stage().style.setProperty('--z', v.z); $('#zoomlbl').textContent = Math.round(v.z * 100) + '%';
}
function zs() { const c = curCanvas(); c.items.forEach((x, i) => { const e = elOf(x.id); if (e) e.style.zIndex = i + 1; }); }
function renderCanvas() {
  const c = curCanvas(), st = stage(); H(c); st.innerHTML = '<div id="bgl"></div><div id="glass"></div><div id="world"></div>';
  c.items.forEach((it) => { const el = mkItem(it); if (el) world().append(el); }); zs(); applyView(); updateBg(); select([]);
}
function drawAmb(d, it) { // copia 32x32 della parte visibile: la sfocatura CSS ne fa un bagliore che nasce dai bordi
  const m = $(`.it[data-id="${it.id}"] video, .it[data-id="${it.id}"] img`, stage()); if (!m) return;
  const go = () => { try { const c = cropOf(it), W = m.naturalWidth || m.videoWidth, Hh = m.naturalHeight || m.videoHeight; drawLv(d.getContext('2d'), it).drawImage(m, c.l * W, c.t * Hh, (1 - c.l - c.r) * W, (1 - c.t - c.b) * Hh, 0, 0, 32, 32); } catch {} };
  if (m.tagName === 'IMG' && !m.complete) { m.addEventListener('load', go, { once: true }); return; }
  if (m.tagName === 'VIDEO' && m.readyState < 2) { m.addEventListener('loadeddata', go, { once: true }); return; }
  go();
}
function updateBg() {
  updateGBox();
  const c = curCanvas(), b = $('#bgl'); if (!c || !b) return; const st = stage();
  st.style.background = c.bg.mode === 'hex' ? c.bg.hex : BASE; st.classList.toggle('auto', c.bg.mode === 'auto'); st.style.setProperty('--glow', c.bg.glow ?? .5);
  const want = new Set();
  if (c.bg.mode === 'auto') c.items.forEach((it) => {
    if (it.kind !== 'img' || !lib(it.lib)) return; want.add(it.id); let d = b.querySelector(`[data-b="${it.id}"]`);
    if (!d) { d = document.createElement('canvas'); d.width = d.height = 32; d.className = 'amb'; d.dataset.b = it.id; b.append(d); drawAmb(d, it); }
    const k = 1.18, w = it.w * k, h = it.h * k;
    d.style.width = w + 'px'; d.style.height = h + 'px'; d.style.left = it.x + it.w / 2 - w / 2 + 'px'; d.style.top = it.y + it.h / 2 - h / 2 + 'px';
    d.style.transform = `rotate(${it.rot}deg)`; d.style.filter = `blur(${Math.max(it.w, it.h) * .1}px) saturate(1.1)`; d.style.opacity = Math.min(1, (it.glow ?? c.bg.glow ?? .5) * 1.3);
  });
  b.querySelectorAll('.amb').forEach((d) => { if (!want.has(d.dataset.b)) d.remove(); });
}
setInterval(() => { // il bagliore di video e GIF segue il fotogramma corrente
  if (view !== 'canvas') return; const c = curCanvas(); if (!c || c.bg.mode !== 'auto') return;
  c.items.forEach((it) => { if (it.kind !== 'img' || !isAnim(lib(it.lib))) return; const d = $(`.amb[data-b="${it.id}"]`); if (d) drawAmb(d, it); });
}, 70);

/* Selezione (singola e multipla) */
function addHandles() {
  document.querySelectorAll('.hd,.rot,.nc,.ch,#gbox').forEach((h) => h.remove());
  if (sel.length !== 1) { buildGBox(); return; } const it = itemOf(sel[0]), el = elOf(sel[0]); if (!it || !el) return; const crop = cropId === it.id;
  (crop ? ['n', 'e', 's', 'w'] : it.kind === 'line' ? ['-1,0', '1,0'] : ['-1,-1', '1,-1', '-1,1', '1,1']).forEach((k) => { const h = document.createElement('div'); h.className = crop ? 'ch' : 'hd'; h.dataset.c = k; el.append(h); });
  if (!crop && it.kind !== 'frame') { const r = document.createElement('div'); r.className = 'rot'; el.append(r); }
  if (it.kind === 'note') {
    const n = document.createElement('div'); n.className = 'nc'; n.innerHTML = NOTE_COLORS.map((k) => `<b data-k="${k}" style="background:${k}"></b>`).join('');
    n.onclick = (e) => { const b = e.target.closest('b'); if (!b) return; it.color = b.dataset.k; $('.note', el).style.background = it.color; commit(); }; el.append(n);
  }
}
function select(ids) {
  if (cropId && !(ids && ids.length === 1 && ids[0] === cropId)) { const o = itemOf(cropId), el = o && elOf(cropId); cropId = null; if (o && el) { fillIn(el, o); applyTf(el, o); } }
  sel = ids ? [...ids] : []; stage().querySelectorAll('.it').forEach((el) => el.classList.toggle('sel', sel.includes(el.dataset.id)));
  addHandles(); renderProps();
}
function front(c, it) { c.items.push(c.items.splice(c.items.indexOf(it), 1)[0]); zs(); }
function addItems(its) {
  const c = curCanvas(); its.forEach((it) => { c.items.push(it); const el = mkItem(it); if (el) { el.classList.add('new'); world().append(el); } });
  zs(); select(its.map((i) => i.id)); updateBg(); commit();
}
const addItem = (it) => { addItems([it]); return elOf(it.id); };
function deleteSel() { const c = curCanvas(); if (!sel.length) return; const ids = new Set(sel); c.items = c.items.filter((i) => !ids.has(i.id)); ids.forEach((id) => elOf(id)?.remove()); select([]); updateBg(); commit(); }
function duplicateSel() { if (!sel.length) return; addItems(selItems().map((i) => ({ ...clone(i), id: uid(), x: i.x + 24, y: i.y + 24 }))); }
function center() { const v = vw(), st = stage(); return { x: (st.clientWidth / 2 - v.x) / v.z + (Math.random() - .5) * 100, y: (st.clientHeight / 2 - 40 - v.y) / v.z + (Math.random() - .5) * 100 }; }
function addImage(entry, pos) {
  if (phTarget) { const ph = itemOf(phTarget); phTarget = null; if (ph && ph.kind === 'ph') return fillPlaceholder(ph, entry); }
  const k = Math.min(1, 300 / Math.max(entry.nw, entry.nh)), w = entry.nw * k, h = entry.nh * k, p = pos || center();
  addItem({ id: uid(), kind: 'img', lib: entry.id, x: p.x - w / 2, y: p.y - h / 2, w, h, rot: 0 });
}
function addNote() { const p = center(); editText(addItem({ id: uid(), kind: 'note', text: 'Nuova nota', color: NOTE_COLORS[0], x: p.x - 100, y: p.y - 70, w: 200, h: 140, rot: 0 })); }
function addElement(type, extra = {}) {
  const d = { ...DEF[type], ...extra }, p = center(), it = { id: uid(), rot: 0, ...d, x: p.x - d.w / 2, y: p.y - d.h / 2 };
  const el = addItem(it); if (type === 'text' && !extra.text) editText(el); if (type === 'frame') { const c = curCanvas(); c.items.unshift(c.items.pop()); zs(); } return it;
}
function editText(el) {
  const it = itemOf(el.dataset.id), n = $('.note,.txt,.flbl', el); if (!n) return;
  n.contentEditable = 'true'; n.focus(); document.execCommand('selectAll');
  n.onblur = () => { n.contentEditable = 'false'; it.text = n.innerText.trim() || (it.kind === 'note' ? 'Nota' : it.kind === 'frame' ? 'Riquadro' : 'Testo'); n.innerText = it.text; commit(); };
}
const alignPool = () => (sel.length > 1 ? selItems() : curCanvas().items.filter((i) => i.kind === 'img')).filter((i) => i.kind !== 'frame');
function align(list) {
  const c = curCanvas(), st = stage(), v = vw(), pool = list || alignSort(alignPool(), S.settings.alignMode || 'read', !!S.settings.alignRev);
  if (!pool.length) return toast('Nessun elemento da allineare');
  const ox = -v.x / v.z, oy = -v.y / v.z, VW = st.clientWidth / v.z, VH = st.clientHeight / v.z, gap = { s: 8, n: 24, l: 56 }[S.settings.alignGap || 'n'];
  const f = fitLayout(pool, S.settings.alignLay || 'rows', VW - 120 / v.z, VH - 200 / v.z, gap), x0 = ox + (VW - f.w) / 2, y0 = oy + (VH - f.h) / 2 - 30 / v.z;
  f.rects.forEach((q, k) => Object.assign(pool[k], { x: x0 + q.x, y: y0 + q.y, w: q.w, h: q.h, rot: 0 }));
  st.classList.add('anim'); pool.forEach((i) => applyTf(elOf(i.id), i)); updateBg(); commit(); setTimeout(() => st.classList.remove('anim'), 450);
}

/* Pannello proprietà */
function renderProps() {
  const p = $('#props'), c = curCanvas(); const items = c ? selItems() : [];
  if (!items.length) { p.classList.add('hidden'); p.innerHTML = ''; return; }
  p.classList.remove('hidden'); const one = items.length === 1 ? items[0] : null, k = one && one.kind, f = items[0], cropping = one && cropId === one.id;
  const row = (ic, l, ctl) => `<label class="pr"><span>${ic ? icon(ic, 16) : ''}${l}</span>${ctl}</label>`;
  let h = `<div class="pt">${one ? (k === 'img' && lib(one.lib)?.type === 'video' ? 'Video' : KIND[k]) : items.length + ' elementi'}</div>`;
  h += row('opacity', 'Opacità', `<input type="range" id="p-op" min="10" max="100" value="${Math.round((f.op ?? 1) * 100)}">`);
  if (!one || ['img', 'shape', 'color', 'note', 'ph'].includes(k)) h += row('rounded_corner', 'Angoli', `<input type="range" id="p-rad" min="0" max="50" value="${f.rad || 0}">`);
  if (!one || k !== 'line') h += row('', 'Ombra', `<input type="checkbox" id="p-sh" ${f.sh ? 'checked' : ''}>`);
  if (items.every((i) => i.kind === 'img')) h += row('', 'Bagliore', `<span class="cc"><input type="range" id="p-gl" min="0" max="100" value="${Math.round((f.glow ?? c.bg.glow ?? .5) * 100)}"><button class="mini" id="p-glr" title="Usa il bagliore del canvas">Auto</button></span>`);
  if (one) {
    if (['text', 'shape', 'color', 'line', 'path'].includes(k)) h += row('palette', 'Colore', `<span class="cc"><input type="color" id="p-col" value="${one.color}"><input type="text" id="p-hex" maxlength="7" value="${one.color.toUpperCase()}"></span>`);
    if (k === 'text') h += row('text_fields', 'Dimensione', `<input type="range" id="p-fs" min="10" max="120" value="${one.fs}">`);
    if (k === 'shape') h += row('', 'Forma', `<select id="p-shp"><option value="rect" ${one.shape === 'rect' ? 'selected' : ''}>Rettangolo</option><option value="ellipse" ${one.shape === 'ellipse' ? 'selected' : ''}>Ellisse</option></select>`);
    if (k === 'line') h += row('arrow_right_alt', 'Freccia', `<input type="checkbox" id="p-arrow" ${one.arrow ? 'checked' : ''}>`);
    if (k === 'img') h += `<div class="pb"><button id="p-crop" class="${cropping ? 'on' : ''}">${icon('crop', 16)}${cropping ? 'Fine ritaglio' : 'Ritaglia'}</button>${one.crop ? '<button id="p-crop0">Azzera</button>' : ''}</div>` + (cropping ? '<small class="hint">Trascina i bordi · Invio per finire</small>' : '') + `<input class="ti" id="p-ct" maxlength="60" placeholder="Titolo (facoltativo)" value="${esc(one.cap?.t || '')}"><input class="ti" id="p-cd" maxlength="140" placeholder="Descrizione (facoltativa)" value="${esc(one.cap?.d || '')}">`;
    if (k === 'ph') h += `<button class="pb1" id="p-ph">${icon('image', 16)}Scegli immagine…</button>`;
    if (k === 'link') h += `<input class="ti" id="p-url" placeholder="https://…" value="${esc(one.url)}"><button class="pb1" id="p-open">${icon('open_in_new', 16)}Apri nel browser</button>`;
  }
  if (one && k === 'frame') h += `<input class="ti" id="p-ftext" maxlength="60" placeholder="Nome del riquadro" value="${esc(one.text || '')}">`;
  h += typeof vecHtml === 'function' ? vecHtml(items) : '';
  h += extraHtml(items);
  h += `<div class="pb"><button id="p-dup">${icon('content_copy', 16)}Duplica</button><button id="p-del">${icon('delete', 16)}Elimina</button></div>`;
  p.innerHTML = h;
  const each = (fn) => selItems().forEach(fn), live = (id, fn, ev = 'oninput') => { const e = $(id, p); if (e) e[ev] = (x) => { fn(x.target); commitSoon(); }; };
  live('#p-op', (t) => each((i) => { i.op = t.value / 100; elOf(i.id).style.opacity = i.op; }));
  live('#p-rad', (t) => each((i) => { i.rad = +t.value; applyTf(elOf(i.id), i); }));
  live('#p-sh', (t) => each((i) => { i.sh = t.checked; styleIn(elOf(i.id), i); }));
  live('#p-gl', (t) => { each((i) => { i.glow = t.value / 100; }); updateBg(); });
  if ($('#p-glr', p)) $('#p-glr', p).onclick = () => { each((i) => { delete i.glow; }); updateBg(); renderProps(); commit(); };
  const setCol = (v) => { one.color = v; refresh(one); };
  live('#p-col', (t) => { $('#p-hex', p).value = t.value.toUpperCase(); setCol(t.value); });
  live('#p-hex', (t) => { if (HEX.test(t.value)) { const v = '#' + t.value.replace('#', ''); $('#p-col', p).value = v; setCol(v.toLowerCase()); } });
  live('#p-fs', (t) => { one.fs = +t.value; refresh(one); });
  live('#p-shp', (t) => { one.shape = t.value; refresh(one); }, 'onchange');
  live('#p-arrow', (t) => { one.arrow = t.checked; refresh(one); });
  const cap = () => { one.cap = { t: $('#p-ct', p).value, d: $('#p-cd', p).value }; refresh(one); }; live('#p-ct', cap); live('#p-cd', cap);
  live('#p-url', (t) => { one.url = t.value.trim(); refresh(one); });
  if ($('#p-crop', p)) $('#p-crop', p).onclick = toggleCrop;
  if ($('#p-crop0', p)) $('#p-crop0', p).onclick = () => { one.crop = null; refresh(one); redrawAmb(one); updateBg(); commit(); renderProps(); };
  if ($('#p-ph', p)) $('#p-ph', p).onclick = () => pickForPh(one.id);
  if ($('#p-open', p)) $('#p-open', p).onclick = () => { const u = normUrl(one.url); u ? aura.openLink(u) : toast('Inserisci un indirizzo valido'); };
  if ($('#p-ftext', p)) live('#p-ftext', (t) => { one.text = t.value; refresh(one); });
  $('#p-dup', p).onclick = duplicateSel; $('#p-del', p).onclick = deleteSel;
  bindExtras(p); if (typeof bindVec === 'function') bindVec(p);
}

/* Interazione sul canvas */
function startPan(e) {
  const st = stage(), v = vw(), sx0 = e.clientX, sy0 = e.clientY, ox = v.x, oy = v.y; st.setPointerCapture(e.pointerId); st.classList.add('panning');
  const mv = (ev) => { v.x = ox + ev.clientX - sx0; v.y = oy + ev.clientY - sy0; applyView(); };
  st.addEventListener('pointermove', mv); st.addEventListener('pointerup', () => { st.removeEventListener('pointermove', mv); st.classList.remove('panning'); save(); }, { once: true });
}
function marquee(e) { // selezione a riquadro
  const st = stage(), r = st.getBoundingClientRect(), v = vw(), add = e.shiftKey || e.ctrlKey, base = add ? [...sel] : [];
  if (!add) select([]); const m = document.createElement('div'); m.id = 'marq'; st.append(m); const sx0 = e.clientX - r.left, sy0 = e.clientY - r.top; st.setPointerCapture(e.pointerId);
  const mv = (ev) => {
    const x = ev.clientX - r.left, y = ev.clientY - r.top, l = Math.min(x, sx0), t = Math.min(y, sy0), w = Math.abs(x - sx0), h = Math.abs(y - sy0);
    Object.assign(m.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
    const a = (l - v.x) / v.z, b = (t - v.y) / v.z, a2 = (l + w - v.x) / v.z, b2 = (t + h - v.y) / v.z;
    const hit = curCanvas().items.filter((i) => { const q = itemBox(i); return q.x < a2 && q.x2 > a && q.y < b2 && q.y2 > b; }).map((i) => i.id);
    const next = [...new Set([...base, ...hit])]; if (next.join() !== sel.join()) select(next);
  };
  st.addEventListener('pointermove', mv); st.addEventListener('pointerup', () => { st.removeEventListener('pointermove', mv); m.remove(); }, { once: true });
}
function bindStage() {
  const st = stage();
  st.oncontextmenu = (e) => { e.preventDefault(); if (typeof PRES !== 'undefined' && PRES.on) { presentStep(-1); return; } if (typeof PEN !== 'undefined' && PEN.on) { penFinish(false); return; } if (typeof PTE !== 'undefined' && PTE.on) { pteExit(); return; } quickMenu(e); };
  st.onmousedown = (e) => { if (e.button === 1) e.preventDefault(); };
  st.onpointerdown = (e) => {
    if (typeof PRES !== 'undefined' && PRES.on) { presentClick(e); return; }
    if (typeof PEN !== 'undefined' && PEN.on && e.button === 0) { penDown(e); return; }
    if (typeof PTE !== 'undefined' && PTE.on && e.button === 0 && pteDown(e)) return;
    if (e.button === 1 || (e.button === 0 && spaceDown)) { e.preventDefault(); startPan(e); return; }
    if (e.button !== 0) return;
    const gh = e.target.closest('.gh,.gr'); if (gh) { groupTransform(e, gh); return; }
    const hd = e.target.closest('.hd,.rot,.ch'); let el = e.target.closest('.it');
    if (!el) { marquee(e); return; }
    if (e.target.closest('.nc') || e.target.isContentEditable) return;
    const c = curCanvas(), v = vw(); let it = itemOf(el.dataset.id), group;
    const multi = (e.shiftKey || e.ctrlKey) && !hd; let tog = false, axis = null;
    if (multi) { if (sel.includes(it.id)) tog = true; else select([...sel, it.id]); group = selItems(); }
    else if (e.altKey && !hd) { // Alt + trascina = copia (gli originali restano, trascini le copie)
      const src = sel.includes(it.id) ? selItems() : [it], at = src.indexOf(it), cps = src.map((s) => ({ ...clone(s), id: uid() }));
      cps.forEach((cp) => { c.items.push(cp); const ne = mkItem(cp); if (ne) world().append(ne); }); zs(); select(cps.map((x) => x.id)); updateBg(); group = cps; it = cps[at]; el = elOf(it.id);
    } else { if (!sel.includes(it.id)) select([it.id]); group = selItems(); if (group.length === 1 && it.kind !== 'frame') front(c, it); }
    if (!hd && !multi && group.length === 1 && it.kind === 'frame') group = [it, ...containedIn(c, it)];
    const r = st.getBoundingClientRect(), P = (ev) => ({ x: (ev.clientX - r.left - v.x) / v.z, y: (ev.clientY - r.top - v.y) / v.z }), p0 = P(e), o = { ...it }, o0 = group.map((g) => ({ x: g.x, y: g.y }));
    let fn, moved = false; el.setPointerCapture(e.pointerId);
    if (hd && hd.classList.contains('rot')) {
      fn = (ev) => { const p = P(ev); let a = Math.atan2(p.y - (o.y + o.h / 2), p.x - (o.x + o.w / 2)) * 180 / Math.PI + 90; if (ev.shiftKey) a = Math.round(a / 15) * 15; it.rot = a; };
    } else if (hd && hd.classList.contains('ch')) { // bordi del ritaglio
      const side = hd.dataset.c, th = o.rot * Math.PI / 180, co = Math.cos(th), si = Math.sin(th), cc = cropOf(it), fw = 1 - cc.l - cc.r, fh = 1 - cc.t - cc.b, mw = o.w / fw, mh = o.h / fh, C = [o.x + o.w / 2, o.y + o.h / 2];
      const lim = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
      fn = (ev) => {
        const p = P(ev), dx = p.x - C[0], dy = p.y - C[1], lx = dx * co + dy * si, ly = -dx * si + dy * co; let nw = o.w, nh = o.h, sx = 0, sy = 0; const n = { ...cc };
        if (side === 'w') { const a = lim(lx + o.w / 2, -cc.l * mw, (fw - .05) * mw); n.l = cc.l + a / mw; nw = o.w - a; sx = a / 2; }
        if (side === 'e') { const a = lim(o.w / 2 - lx, -cc.r * mw, (fw - .05) * mw); n.r = cc.r + a / mw; nw = o.w - a; sx = -a / 2; }
        if (side === 'n') { const a = lim(ly + o.h / 2, -cc.t * mh, (fh - .05) * mh); n.t = cc.t + a / mh; nh = o.h - a; sy = a / 2; }
        if (side === 's') { const a = lim(o.h / 2 - ly, -cc.b * mh, (fh - .05) * mh); n.b = cc.b + a / mh; nh = o.h - a; sy = -a / 2; }
        it.crop = n; it.w = nw; it.h = nh; it.x = C[0] + sx * co - sy * si - nw / 2; it.y = C[1] + sx * si + sy * co - nh / 2;
      };
    } else if (hd) {
      const [sx1, sy1] = hd.dataset.c.split(',').map(Number), th = o.rot * Math.PI / 180, co = Math.cos(th), si = Math.sin(th), ln = it.kind === 'line';
      const rot = (q, s) => [q[0] * co - s * q[1] * si, s * q[0] * si + q[1] * co];
      const d = [sx1 * o.w, sy1 * o.h], hc = rot([d[0] / 2, d[1] / 2], 1), O = [o.x + o.w / 2 - hc[0], o.y + o.h / 2 - hc[1]];
      fn = (ev) => {
        const p = P(ev), q = rot([p.x - O[0], p.y - O[1]], -1);
        if (!ln && (S.settings.propResize !== false) === !!ev.shiftKey) { const nw = Math.max(40, q[0] * sx1), nh = Math.max(40, q[1] * sy1), nc2 = rot([sx1 * nw / 2, sy1 * nh / 2], 1); it.w = nw; it.h = nh; it.x = O[0] + nc2[0] - nw / 2; it.y = O[1] + nc2[1] - nh / 2; return; }
        const s = Math.max((q[0] * d[0] + q[1] * d[1]) / (d[0] ** 2 + d[1] ** 2), 40 / (ln ? o.w : Math.min(o.w, o.h))), nc = rot([d[0] * s / 2, d[1] * s / 2], 1);
        it.w = o.w * s; it.h = ln ? o.h : o.h * s; it.x = O[0] + nc[0] - it.w / 2; it.y = O[1] + nc[1] - it.h / 2;
      };
    } else fn = (ev) => { // Maiusc: movimento dritto (asse bloccato) e calamita sui bordi/centri degli altri elementi
      const p = P(ev); let dx = p.x - p0.x, dy = p.y - p0.y; guidesOff();
      if (ev.shiftKey) {
        if (!axis && Math.hypot(dx, dy) * v.z > 6) axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (axis === 'x') dy = 0; else if (axis === 'y') dx = 0;
        if (axis) { const sn = snapMove(group, o0, dx, dy, axis, 8 / v.z); dx = sn.dx; dy = sn.dy; showGuides(sn.g, v.z); }
      } else { axis = null; if (S.settings.guides) { const sn = snapBoth(group, o0, dx, dy, 8 / v.z); dx = sn.dx; dy = sn.dy; showGuides(sn.g, v.z); } } // Ctrl+U: guide automatiche
      group.forEach((g, i) => { g.x = o0[i].x + dx; g.y = o0[i].y + dy; });
    };
    const mv = (ev) => { if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return; moved = true; fn(ev); if (hd && hd.classList.contains('ch')) { refresh(it); redrawAmb(it); } else (hd ? [it] : group).forEach((g) => applyTf(elOf(g.id), g)); updateBg(); };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', () => { el.removeEventListener('pointermove', mv); guidesOff(); if (!moved && tog) select(sel.filter((x) => x !== it.id)); else if (!moved && group.length > 1 && !hd && !multi) select([it.id]); else commit(); }, { once: true });
  };
  st.ondblclick = (e) => { if (typeof PEN !== 'undefined' && PEN.on) { penFinish(false); return; } if (typeof PTE !== 'undefined' && PTE.on) { pteDbl(e); return; } const el = e.target.closest('.it'); if (!el) return; const it = itemOf(el.dataset.id); if (it.kind === 'shape' || it.kind === 'path') { pteEnter(it); return; } if (it.kind === 'note' || it.kind === 'text' || it.kind === 'frame') editText(el); else if (it.kind === 'img') toggleCrop(); else if (it.kind === 'ph') pickForPh(it.id); else if (it.kind === 'link') { const u = normUrl(it.url); if (u) aura.openLink(u); } };
  st.addEventListener('wheel', (e) => { // Alt + rotella = zoom sul puntatore
    if (typeof PRES !== 'undefined' && PRES.on) { e.preventDefault(); return; }
    if (!e.altKey) return; e.preventDefault();
    const v = vw(), r = st.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, z = Math.min(4, Math.max(.1, v.z * Math.exp(-e.deltaY * .0015)));
    v.x = mx - (mx - v.x) * z / v.z; v.y = my - (my - v.y) * z / v.z; v.z = z; st.classList.add('zm'); clearTimeout(st._t); st._t = setTimeout(() => st.classList.remove('zm'), 160); applyView(); save();
  }, { passive: false });
  $('#zoomlbl').onclick = () => { Object.assign(vw(), { x: 0, y: 0, z: 1 }); st.classList.add('zm'); applyView(); setTimeout(() => st.classList.remove('zm'), 300); save(); };
  st.ondragover = (e) => e.preventDefault();
  st.ondrop = async (e) => {
    e.preventDefault(); const dt = e.dataTransfer, v = vw(), r = st.getBoundingClientRect(), pos = { x: (e.clientX - r.left - v.x) / v.z, y: (e.clientY - r.top - v.y) / v.z }, raw = dt.getData('text/aura'), fl = [...dt.files];
    const uri = (dt.getData('text/uri-list') || '').split('\n').find((l) => l && !l.startsWith('#')) || '', html = dt.getData('text/html'), txt = (dt.getData('text/plain') || '').trim();
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.it'), tg = hit && itemOf(hit.dataset.id); if (tg && tg.kind === 'ph') phTarget = tg.id;
    if (raw) { const d = JSON.parse(raw), en = d.kind === 'lib' && lib(d.id); if (en) addImage(en, pos); return; }
    const aud = fl.filter((f) => /\.(mp3|wav|flac|m4a|aac|ogg|opus)$/i.test(f.name)); if (aud.length) { playerAddFiles(aud); if (aud.length === fl.length) return; }
    if (fl.length) { const en = await ingest(await importDropped(fl.filter((f) => !aud.includes(f))), null); if (en.length) { en.forEach((x) => addImage(x, { x: pos.x + Math.random() * 40, y: pos.y + Math.random() * 40 })); return; } }
    const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html), cand = (m && m[1]) || uri || (/^https?:\/\/\S+$/i.test(txt) ? txt : '');
    if (!/^https?:\/\//i.test(cand)) return;
    if (m || /\.(png|jpe?g|webp|avif|gif|mp4)(\?|#|$)/i.test(cand)) { const en = await ingest(await aura.importUrl(cand), null); if (en.length) { en.forEach((x) => addImage(x, pos)); return; } toast('Impossibile scaricare l’immagine'); if (m) return; }
    const u = normUrl(cand); if (u) addElement('link', { url: u });
  };
}
/* Copia, incolla, taglia */
function copySel() { if (!sel.length) return false; clip = selItems().map(clone); pasteN = 0; navigator.clipboard.writeText('AURA').catch(() => {}); return true; }
function pasteInternal() { if (!clip.length) return; pasteN++; addItems(clip.map((i) => ({ ...clone(i), id: uid(), x: i.x + 24 * pasteN, y: i.y + 24 * pasteN }))); }
async function pasteText(t) {
  if (/^https?:\/\/\S+$/i.test(t)) {
    if (/\.(png|jpe?g|webp|avif|gif|mp4)(\?|#|$)/i.test(t)) { const en = await ingest(await aura.importUrl(t), null); if (en.length) { en.forEach((x) => addImage(x)); return; } }
    addElement('link', { url: t }); return;
  }
  addElement('text', { text: t.slice(0, 500) });
}
async function paste() {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const t = item.types.find((x) => x.startsWith('image/')); if (!t) continue;
      const blob = await item.getType(t), en = await ingest(await aura.importBuffer('incollata.' + (t.split('/')[1] || 'png'), new Uint8Array(await blob.arrayBuffer())), null); en.forEach((x) => addImage(x)); return;
    }
    for (const item of items) {
      if (!item.types.includes('text/plain')) continue; const t = (await (await item.getType('text/plain')).text()).trim();
      if (!t) continue; if (t === 'AURA') break; await pasteText(t); return;
    }
  } catch {}
  pasteInternal();
}
document.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.altKey && e.code === 'KeyC' && !editing()) { e.preventDefault(); toggleCompact(); return; }
  if (view !== 'canvas' || editing()) return;
  if (e.code === 'Space') { e.preventDefault(); if (!spaceDown) { spaceDown = true; stage().classList.add('pan-ready'); } return; }
  if (ctrl && e.code === 'KeyZ') { e.preventDefault(); (e.altKey || e.shiftKey) ? redo() : undo(); return; }
  if (ctrl && e.code === 'KeyY') { e.preventDefault(); redo(); return; }
  if (ctrl && e.code === 'KeyA') { e.preventDefault(); select(curCanvas().items.map((i) => i.id)); return; }
  if (ctrl && e.code === 'KeyD') { e.preventDefault(); duplicateSel(); return; }
  if (ctrl && e.code === 'KeyC') { e.preventDefault(); copySel(); return; }
  if (ctrl && e.code === 'KeyX') { e.preventDefault(); if (copySel()) deleteSel(); return; }
  if (ctrl && e.code === 'KeyV') { e.preventDefault(); paste(); return; }
  if ((e.key === 'Escape' || e.key === 'Enter') && cropId) { e.preventDefault(); toggleCrop(); return; }
  if (sel.length && !ctrl && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) { // frecce = sposta di 1 px, con Maiusc di 10 px
    e.preventDefault(); const n = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
    selItems().forEach((g) => { g.x += dx; g.y += dy; applyTf(elOf(g.id), g); }); updateBg(); commitSoon(); return;
  }
  if (e.key === 'Escape') { select([]); return; }
  if (sel.length && (e.key === 'Delete' || e.key === 'Backspace')) deleteSel();
});
document.addEventListener('keyup', (e) => { if (e.code === 'Space') { spaceDown = false; stage()?.classList.remove('pan-ready'); if (view === 'canvas' && !editing()) e.preventDefault(); } });
addEventListener('blur', () => { spaceDown = false; stage()?.classList.remove('pan-ready'); });
document.addEventListener('dragenter', (e) => { if (e.dataTransfer.types.includes('Files')) document.body.classList.add('dropping'); });
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => { e.preventDefault(); document.body.classList.remove('dropping'); const f = [...e.dataTransfer.files].find((x) => /\.aura$/i.test(x.name)); if (f) { let p = ''; try { p = aura.pathOf(f); } catch {} if (p) importProjectFile(p); } });

/* ---------- Popover ---------- */
function closePop() { $('#pop').classList.add('hidden'); popKind = null; phTarget = null; }
function showPop(html, kind) {
  const p = $('#pop'); if (popKind === kind) { closePop(); return null; }
  p.innerHTML = html; p.classList.remove('hidden'); popKind = kind;
  const t = $('#toolbar').getBoundingClientRect(), s = $('#canvas').getBoundingClientRect();
  p.style.left = Math.max(8, Math.min(t.left - s.left, s.width - p.offsetWidth - 8)) + 'px';
  p.style.top = (t.top - s.top > p.offsetHeight + 16 ? t.top - s.top - p.offsetHeight - 10 : t.bottom - s.top + 10) + 'px'; return p;
}
function kmeans(px, k) {
  if (!px.length) return []; const sorted = [...px].sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2])); const cs = Array.from({ length: k }, (_, i) => sorted[Math.floor((i + .5) * sorted.length / k)].slice()); let sz = [];
  for (let t = 0; t < 8; t++) {
    const sum = cs.map(() => [0, 0, 0, 0]);
    px.forEach((p) => { let b = 0, bd = 1e12; cs.forEach((c, i) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; b = i; } }); const a = sum[b]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++; });
    sum.forEach((a, i) => { if (a[3]) cs[i] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; }); sz = sum.map((a) => a[3]);
  }
  return cs.map((c, i) => ({ c, n: sz[i] })).filter((o) => o.n > 0).sort((a, b) => b.n - a.n).map((o) => '#' + o.c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase());
}
function paletteData(c) {
  const px = [], cv = document.createElement('canvas'); cv.width = cv.height = 24; const x = cv.getContext('2d', { willReadFrequently: true });
  c.items.forEach((it) => { if (it.kind !== 'img') return; const m = $(`.it[data-id="${it.id}"] video, .it[data-id="${it.id}"] img`, stage()); if (!m) return; try { x.drawImage(m, 0, 0, 24, 24); const d = x.getImageData(0, 0, 24, 24).data; for (let i = 0; i < d.length; i += 8) px.push([d[i], d[i + 1], d[i + 2]]); } catch {} });
  const used = [...new Set(c.items.map((i) => ['shape', 'color', 'line', 'text'].includes(i.kind) ? i.color : i.kind === 'note' ? (i.color || NOTE_COLORS[0]) : '').filter(Boolean).map((k) => k.toUpperCase()))];
  return { img: kmeans(px, 6), used };
}
function copyText(t, msg) { navigator.clipboard.writeText(t).then(() => toast(msg), () => toast('Copia non riuscita')); }
function palettePanel(c) {
  const pal = paletteData(c), all = [...pal.used, ...pal.img.filter((k) => !pal.used.includes(k))];
  const grp = (t, l) => l.length ? `<div class="pl"><span>${t}</span><div class="ps">${l.map((k) => `<button class="pk1" data-k="${k}"><i style="background:${k}"></i>${k}</button>`).join('')}</div></div>` : '';
  const box = $('#pn-pal'); box.innerHTML = (all.length ? grp('Dalle immagini', pal.img) + grp('Colori usati', pal.used) : '<p class="hint">Aggiungi immagini o blocchi colore per vedere la palette.</p>') + `<div class="pb"><button id="x-css">Copia CSS</button><button id="x-json">Copia JSON</button><button id="x-svg">SVG per Figma</button></div><small class="hint">Clic su un colore per copiare il codice HEX.</small>`;
  box.querySelectorAll('.pk1').forEach((b) => b.onclick = () => copyText(b.dataset.k, b.dataset.k + ' copiato'));
  const need = () => { if (!all.length) { toast('Nessun colore da esportare'); return false; } return true; };
  $('#x-css').onclick = () => need() && copyText(`:root {\n${all.map((k, i) => `  --aura-${i + 1}: ${k};`).join('\n')}\n}`, 'CSS copiato');
  $('#x-json').onclick = () => need() && copyText(JSON.stringify({ aura: Object.fromEntries(all.map((k, i) => ['colore-' + (i + 1), { value: k, type: 'color' }])) }, null, 2), 'JSON copiato (Tokens Studio)');
  $('#x-svg').onclick = async () => { if (!need()) return; const W = 140; const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${all.length * W}" height="190" viewBox="0 0 ${all.length * W} 190">${all.map((k, i) => `<rect x="${i * W}" y="0" width="${W}" height="150" fill="${k}"/><text x="${i * W + 10}" y="175" font-family="monospace" font-size="14" fill="#111">${k}</text>`).join('')}</svg>`; if (await aura.saveText('palette-' + c.name.replace(/[^\w-]+/g, '_'), 'svg', svg)) toast('SVG salvato: trascinalo in Figma'); };
}
function palettePop() {
  const c = curCanvas(), cols = [...new Set(c.items.map((i) => i.kind === 'img' && lib(i.lib)?.color).filter(Boolean))];
  const p = showPop(`<div class="seg" id="ptabs"><button data-t="bg" class="on">Sfondo</button><button data-t="pal">Palette</button></div>
    <div id="pn-bg"><div class="seg" id="mseg"><button data-m="auto">Automatico</button><button data-m="hex">Colore</button></div>
    <div class="row"><input type="color" id="pc"><input type="text" id="ph" maxlength="7" placeholder="#0C0C0D"></div>
    <div class="row"><span>Bagliore</span><input type="range" id="pg" min="0" max="100"></div>
    <div class="sw">${cols.map((k) => `<b data-k="${k}" style="background:${k}" title="${k}"></b>`).join('')}</div></div><div id="pn-pal" class="hidden"></div>`, 'palette'); if (!p) return;
  const sync = () => { p.querySelectorAll('#mseg button').forEach((b) => b.classList.toggle('on', b.dataset.m === c.bg.mode)); $('#pc').value = c.bg.hex.slice(0, 7); $('#ph').value = c.bg.hex.toUpperCase(); $('#pg').value = Math.round((c.bg.glow ?? .5) * 100); };
  const setHex = (v) => { c.bg.hex = '#' + v.replace('#', '').toUpperCase(); c.bg.mode = 'hex'; sync(); updateBg(); commitSoon(); };
  p.querySelectorAll('#ptabs button').forEach((b) => b.onclick = () => { p.querySelectorAll('#ptabs button').forEach((x) => x.classList.toggle('on', x === b)); $('#pn-bg').classList.toggle('hidden', b.dataset.t !== 'bg'); $('#pn-pal').classList.toggle('hidden', b.dataset.t !== 'pal'); if (b.dataset.t === 'pal') palettePanel(c); });
  p.querySelectorAll('#mseg button').forEach((b) => b.onclick = () => { c.bg.mode = b.dataset.m; sync(); updateBg(); commitSoon(); });
  $('#pc').oninput = (e) => setHex(e.target.value); $('#ph').oninput = (e) => { if (HEX.test(e.target.value)) setHex(e.target.value); };
  $('#pg').oninput = (e) => { c.bg.glow = e.target.value / 100; updateBg(); commitSoon(); };
  p.querySelectorAll('.sw b').forEach((b) => b.onclick = () => setHex(b.dataset.k)); sync();
}
function imagePop() {
  const p = showPop(`<button class="wide" id="pcomp">Carica dal computer…</button><div class="pk">${S.library.length ? S.library.map((l) => `<div class="th" draggable="true" data-id="${l.id}">${mediaEl(l)}</div>`).join('') : '<p>La raccolta è vuota.</p>'}</div>`, 'image'); if (!p) return;
  $('#pcomp').onclick = async () => { closePop(); for (const en of await ingest(await aura.pick(), null)) addImage(en); };
  p.querySelectorAll('.th').forEach((t) => { t.onclick = () => addImage(lib(t.dataset.id)); t.ondragstart = (e) => e.dataTransfer.setData('text/aura', JSON.stringify({ kind: 'lib', id: t.dataset.id })); });
}
function elemPop() {
  const items = [['text', 'text_fields', 'Testo'], ['rect', 'rectangle', 'Rettangolo'], ['ellipse', 'circle', 'Ellisse'], ['line', 'horizontal_rule', 'Linea'], ['arrow', 'arrow_right_alt', 'Freccia'], ['color', 'format_color_fill', 'Blocco colore'], ['link', 'link', 'Link'], ['frame', 'select_all', 'Riquadro']];
  const p = showPop(`<div class="eg">${items.map(([k, ic, l]) => `<button data-k="${k}">${icon(ic, 20)}${l}</button>`).join('')}</div>
    <div class="row hidden" id="lkrow"><input type="text" id="lku" placeholder="https://…"><button id="lkgo" class="go">Aggiungi</button></div>`, 'elem'); if (!p) return;
  const addLink = () => { const u = normUrl($('#lku').value); if (!u) return toast('Inserisci un indirizzo valido'); closePop(); addElement('link', { url: u }); };
  p.querySelectorAll('.eg button').forEach((b) => b.onclick = () => { if (b.dataset.k === 'link') { $('#lkrow').classList.remove('hidden'); $('#lku').focus(); } else { closePop(); addElement(b.dataset.k); } });
  $('#lkgo').onclick = addLink; $('#lku').onkeydown = (e) => { if (e.key === 'Enter') addLink(); e.stopPropagation(); };
}

/* ---------- Esportazione (PNG e video) ---------- */
function bounds(c) {
  const v = vw(), st = stage(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  c.items.forEach((it) => { const q = itemBox(it); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x2); y1 = Math.max(y1, q.y2); });
  if (!c.items.length) { x0 = -v.x / v.z; y0 = -v.y / v.z; x1 = x0 + st.clientWidth / v.z; y1 = y0 + st.clientHeight / v.z; } else { x0 -= 60; y0 -= 60; x1 += 60; y1 += 60; }
  return { x0, y0, w: x1 - x0, h: y1 - y0 };
}
async function preloadImages(c) { for (const it of c.items) { const en = it.kind === 'img' && lib(it.lib); if (en && en.type !== 'video') await imgOf(en.file); } }
function wrapDraw(x, text, x0, y0, maxW, lh) {
  let y = y0; text.split('\n').forEach((para) => { let line = ''; para.split(' ').forEach((wd) => { const t = line ? line + ' ' + wd : wd; if (x.measureText(t).width > maxW && line) { x.fillText(line, x0, y); y += lh; line = wd; } else line = t; }); x.fillText(line, x0, y); y += lh; });
  return y;
}
function drawItem(x, it, s) {
  x.save(); x.translate(it.x + it.w / 2, it.y + it.h / 2); x.rotate(it.rot * Math.PI / 180); x.globalAlpha = it.op ?? 1;
  const w = it.w, h = it.h, rad = it.shape === 'ellipse' ? Math.min(w, h) / 2 : (it.rad || 0) / 100 * Math.min(w, h);
  const shadow = () => { if (it.sh && it.kind !== 'line') { x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 40 * s; x.shadowOffsetY = 14 * s; } };
  const noShadow = () => { x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetY = 0; };
  const path = () => { x.beginPath(); if (it.shape === 'ellipse') x.ellipse(0, 0, w / 2, h / 2, 0, 0, 7); else x.roundRect(-w / 2, -h / 2, w, h, rad); };
  if (it.kind === 'note') { shadow(); x.fillStyle = it.color || NOTE_COLORS[0]; path(); x.fill(); noShadow(); x.fillStyle = '#422E0F'; x.font = '18px Hyperlegible, sans-serif'; wrapDraw(x, it.text, -w / 2 + 12, -h / 2 + 30, w - 24, 24); }
  else if (it.kind === 'text') { x.fillStyle = it.color; x.font = `${it.fs}px Hyperlegible, sans-serif`; wrapDraw(x, it.text, -w / 2, -h / 2 + it.fs, w, it.fs * 1.25); }
  else if (it.kind === 'shape' || it.kind === 'color') {
    shadow(); x.fillStyle = it.color; path(); x.fill(); noShadow();
    if (it.kind === 'color') { x.fillStyle = contrast(it.color); x.font = '13px "Fabrikat Mono", monospace'; x.fillText(it.color.toUpperCase(), -w / 2 + 10, h / 2 - 10); }
  } else if (it.kind === 'path') {
    if (typeof Path2D === 'function') { shadow(); x.save(); x.translate(-w / 2, -h / 2); const p2 = new Path2D(pathD(it)); if (it.closed !== false && !it.nofill) { x.fillStyle = it.color; x.fill(p2); } noShadow(); if (it.sw) { x.strokeStyle = it.stroke || '#E3E3E3'; x.lineWidth = it.sw; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(p2); } x.restore(); }
  } else if (it.kind === 'line') {
    x.fillStyle = it.color; x.fillRect(-w / 2, -2, w - (it.arrow ? 12 : 0), 4);
    if (it.arrow) { x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2 - 16, -9); x.lineTo(w / 2 - 16, 9); x.fill(); }
  } else if (it.kind === 'link') {
    let d = it.url; try { d = new URL(it.url).hostname.replace(/^www\./, ''); } catch {}
    shadow(); x.fillStyle = '#141414'; x.beginPath(); x.roundRect(-w / 2, -h / 2, w, h, 0); x.fill(); noShadow();
    x.fillStyle = '#D9D9D9'; x.font = '700 16px Hyperlegible, sans-serif'; x.fillText(d, -w / 2 + 14, -2); x.fillStyle = 'rgba(227,227,227,.71)'; x.font = '12px "Fabrikat Mono", monospace'; x.fillText(it.url.slice(0, 34), -w / 2 + 14, 20);
  } else if (it.kind === 'frame') { /* i riquadri servono alla presentazione: non compaiono nell'export */
  } else {
    const en = lib(it.lib); let src = null;
    if (en && isAnim(en)) { src = $(`.it[data-id="${it.id}"] video, .it[data-id="${it.id}"] img`, stage()); if (!src || (src.tagName === 'VIDEO' && src.readyState < 2)) src = imgCache.get(en.file) || null; } else if (en) src = imgCache.get(en.file);
    if (src) {
      if (it.sh) { shadow(); x.fillStyle = '#000'; path(); x.fill(); noShadow(); }
      x.save(); path(); x.clip(); if (it.lv) x.filter = 'url(#lv-' + it.id + ')'; try { const cr = cropOf(it), sw = src.naturalWidth || src.videoWidth || src.width, sh = src.naturalHeight || src.videoHeight || src.height; x.drawImage(src, cr.l * sw, cr.t * sh, (1 - cr.l - cr.r) * sw, (1 - cr.t - cr.b) * sh, -w / 2, -h / 2, w, h); } catch {}
      x.filter = 'none';
      if (it.cap && (it.cap.t || it.cap.d)) {
        const g = x.createLinearGradient(0, h / 2 - 56, 0, h / 2); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.65)'); x.fillStyle = g; x.fillRect(-w / 2, h / 2 - 56, w, 56);
        x.fillStyle = '#e8e8e8'; let y = h / 2 - 10;
        if (it.cap.d) { x.font = '10px Hyperlegible, sans-serif'; x.fillText(it.cap.d, -w / 2 + 10, y); y -= 14; }
        if (it.cap.t) { x.font = '700 12px Hyperlegible, sans-serif'; x.fillText(it.cap.t, -w / 2 + 10, y); }
      }
      x.restore();
    }
  }
  x.restore();
}
function drawScene(x, b, s) { // disegna un fotogramma del canvas
  const c = curCanvas(); x.fillStyle = c.bg.mode === 'hex' ? c.bg.hex : BASE; x.fillRect(b.x0, b.y0, b.w, b.h);
  if (c.bg.mode === 'auto') {
    c.items.forEach((it) => {
      if (it.kind !== 'img') return; const d = $(`.amb[data-b="${it.id}"]`, stage()); if (!d) return; const w = it.w * 1.18, h = it.h * 1.18;
      x.save(); x.translate(it.x + it.w / 2, it.y + it.h / 2); x.rotate(it.rot * Math.PI / 180); x.globalAlpha = Math.min(1, (it.glow ?? c.bg.glow ?? .5) * 1.3);
      x.filter = `blur(${Math.max(it.w, it.h) * .1 * s}px) saturate(1.1)`; x.drawImage(d, -w / 2, -h / 2, w, h); x.restore();
    });
    const sh = x.createLinearGradient(b.x0, b.y0, b.x0 + b.w, b.y0 + b.h); sh.addColorStop(0, 'rgba(255,255,255,.07)'); sh.addColorStop(.35, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,.05)'); x.fillStyle = sh; x.fillRect(b.x0, b.y0, b.w, b.h);
  }
  for (const it of c.items) drawItem(x, it, s);
}
async function sceneCanvas() {
  const c = curCanvas(), b = bounds(c), k = Math.min(2, 4096 / Math.max(b.w, b.h)), cv = document.createElement('canvas'); cv.width = b.w * k; cv.height = b.h * k;
  await preloadImages(c); const x = cv.getContext('2d'); x.scale(k, k); x.translate(-b.x0, -b.y0); drawScene(x, b, k); return { cv, b };
}
async function exportPng() { try { const { cv } = await sceneCanvas(); if (await aura.saveImage(cv.toDataURL('image/png'))) toast('Immagine esportata'); } catch { toast('Esportazione non riuscita'); } }
async function exportPdf() { try { const { cv, b } = await sceneCanvas(); if (await aura.savePdf(cv.toDataURL('image/png'), Math.round(b.w), Math.round(b.h))) toast('PDF esportato'); } catch { toast('Esportazione non riuscita'); } }
async function exportOriginals() {
  const c = curCanvas(), list = [...new Set(c.items.filter((i) => i.kind === 'img').map((i) => i.lib))].map((id) => lib(id)).filter(Boolean).map((l) => ({ file: l.file, name: l.name }));
  if (!list.length) return toast('Nessun file da esportare'); const n = await aura.saveOriginals(list); if (n) toast(n + ' file copiati');
}
const AV_MIME = () => ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
const VIDEO_MIME = () => ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
async function exportVideo(dur, withAudio) {
  const c = curCanvas(), mime = (withAudio && AV_MIME()) || VIDEO_MIME(); if (!mime) return toast('Questo computer non supporta la registrazione video');
  const b = bounds(c), k = Math.min(1, 1920 / Math.max(b.w, b.h)), W = Math.max(2, Math.round(b.w * k / 2) * 2), Hh = Math.max(2, Math.round(b.h * k / 2) * 2);
  await preloadImages(c); const vids = [...stage().querySelectorAll('video')];
  vids.forEach((v) => { try { v.currentTime = 0; v.play(); } catch {} });
  const adur = withAudio ? tracksOf().filter((t) => t.kind === 'file').reduce((a, t) => a + (t.dur || 0), 0) : 0, durs = vids.map((v) => v.duration).filter(isFinite), hasGif = c.items.some((i) => /\.gif$/i.test(lib(i.lib)?.file || '')), D = dur || Math.min(withAudio && adur ? 600 : 60, Math.max(adur, durs.length ? Math.max(...durs) : (hasGif ? 6 : 5)));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const x = cv.getContext('2d');
  const stream = cv.captureStream(30); let audioStop = null; if (withAudio && typeof startAudioCapture === 'function') audioStop = await startAudioCapture(stream);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10e6, audioBitsPerSecond: 192000 }), chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((r) => { rec.onstop = r; }); let cancel = false;
  const ui = document.createElement('div'); ui.id = 'rec'; ui.innerHTML = '<i></i><span>Registrazione…</span><b></b><button>Annulla</button>'; document.body.append(ui); $('button', ui).onclick = () => { cancel = true; };
  rec.start(250); const t0 = performance.now();
  await new Promise((res) => { const f = () => { const t = (performance.now() - t0) / 1000;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, Hh); x.scale(W / b.w, Hh / b.h); x.translate(-b.x0, -b.y0); drawScene(x, b, W / b.w);
    $('b', ui).textContent = `${Math.min(t, D).toFixed(1)} / ${D.toFixed(1)} s`; if (t < D && !cancel) requestAnimationFrame(f); else res(); }; f(); });
  rec.stop(); await stopped; if (audioStop) audioStop(); ui.remove(); if (cancel) return toast('Esportazione annullata');
  const bytes = new Uint8Array(await new Blob(chunks, { type: mime }).arrayBuffer());
  if (await aura.saveVideo(bytes, mime.includes('mp4') ? 'mp4' : 'webm')) toast('Video esportato');
}
function exportPop() {
  const hasAudio = tracksOf().some((t) => t.kind === 'file');
  const p = showPop(`<button class="wide" id="xp">Immagine (PNG)</button><button class="wide" id="xpdf" style="margin-top:8px">PDF</button>
    <div class="row" style="margin-top:8px"><button class="wide" id="xv">Video (${VIDEO_MIME()?.includes('mp4') ? 'MP4' : 'WebM'})</button><select id="xd" title="Durata">${[['0', 'Auto'], ['5', '5 s'], ['10', '10 s'], ['15', '15 s'], ['30', '30 s'], ['60', '1 min'], ['120', '2 min'], ['300', '5 min'], ['600', '10 min']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
    ${hasAudio ? '<label class="pr" style="margin-top:6px"><span>Includi la musica del canvas</span><input type="checkbox" id="xa" checked></label>' : ''}
    <button class="wide" id="xo" style="margin-top:8px">Cartella con gli originali</button><button class="wide" id="xpr" style="margin-top:8px">File di progetto (.aura)</button>`, 'export'); if (!p) return;
  $('#xp').onclick = () => { closePop(); exportPng(); }; $('#xpdf').onclick = () => { closePop(); exportPdf(); };
  $('#xv').onclick = () => { const d = +$('#xd').value, a = !!($('#xa') && $('#xa').checked); closePop(); exportVideo(d, a); };
  $('#xo').onclick = () => { closePop(); exportOriginals(); }; $('#xpr').onclick = () => { closePop(); exportProject('canvas'); };
}

/* ---------- Modalità design: jingle ---------- */
function jingle() {
  try {
    const ac = new AudioContext(), out = ac.createGain(); out.gain.value = .2; out.connect(ac.destination);
    const dl = ac.createDelay(); dl.delayTime.value = .17; const fb = ac.createGain(); fb.gain.value = .38; const wet = ac.createGain(); wet.gain.value = .45;
    out.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(ac.destination);
    [523.25, 659.25, 783.99, 987.77, 1318.51].forEach((f, i) => {
      const t = ac.currentTime + i * .13, end = t + (i === 4 ? 1.7 : .9);
      [['sine', 1, .5], ['triangle', 2, .12]].forEach(([type, m, a]) => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f * m;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .02); g.gain.exponentialRampToValueAtTime(.0008, end); o.connect(g); g.connect(out); o.start(t); o.stop(end + .05);
      });
    });
    setTimeout(() => ac.close(), 3200);
  } catch {}
}

/* ---------- Viste, header, barra ---------- */
function setView(v) {
  openId = openId || (v === 'canvas' ? S.last : null); if (v === 'canvas' && !curCanvas()) v = 'home';
  const changed = v !== view; view = v; document.body.dataset.v = v;
  ['home', 'canvas', 'library'].forEach((k) => $('#' + k).classList.toggle('hidden', k !== v));
  if (changed) { const s = $('#' + v); s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter'); }
  $('#logo').classList.toggle('green', v !== 'home'); $('#t-canvas').classList.toggle('on', v === 'canvas'); $('#t-library').classList.toggle('on', v === 'library');
  const tw = $('#tw'), cv = v === 'canvas' ? curCanvas() : null;
  tw.innerHTML = '<span id="title" class="mono"></span>' + (cv ? `<button id="swbtn" title="Cambia canvas">${icon('expand_more', 18)}</button><span id="desc" class="desc"></span>` : '');
  const t = $('#title'); t.textContent = cv ? cv.name : v === 'library' ? 'Raccolta' : 'Home';
  if (cv) {
    t.classList.add('edit'); t.title = 'Clic per rinominare'; t.onclick = () => rename(t, cv.name, (n) => { cv.name = n; save(); });
    const d = $('#desc'); d.textContent = cv.desc || 'Aggiungi descrizione'; d.classList.toggle('ph', !cv.desc); d.onclick = () => editDesc(d, cv);
    $('#swbtn').onclick = (e) => { e.stopPropagation(); switchPop(e.currentTarget); };
  }
  closePop(); if (v === 'home') renderGrid('home'); if (v === 'library') renderGrid('library'); if (v === 'canvas') renderCanvas();
  if (typeof playerSync === 'function') playerSync();
}
$('#win').innerHTML = [['min', 'min'], ['max', 'max'], ['close', 'close']].map(([a, n]) => `<button data-w="${a}" title="${a}">${icon(n, 22)}</button>`).join('');
document.querySelectorAll('#win button').forEach((b) => b.onclick = () => aura.win(b.dataset.w));
$('#t-canvas').innerHTML = icon('layers', 20) + 'Tavola'; $('#t-library').innerHTML = icon('collections', 20) + 'Raccolta Immagini';
$('#logo').onclick = () => { if ($('#logo').classList.contains('green')) setView('home'); };
$('#t-canvas').onclick = () => setView('canvas'); $('#t-library').onclick = () => setView('library');
$('#toolbar').innerHTML = `<div id="handle"></div>
  <button id="b-img">${icon('image', 20)}<span class="lb">Immagine</span></button><button id="b-note">${icon('note', 20)}<span class="lb">Nota</span></button><button id="b-el">${icon('add', 20)}<span class="lb">Elemento</span></button><button id="b-align">${icon('align', 20)}<span class="lb">Allinea</span></button><button id="b-pres" title="Presentazione (Maiusc+W)">${icon('slideshow', 20)}</button><button id="b-pen" title="Penna (P)">${icon('ink_pen', 20)}</button>
  <button id="design" title="Modalità design (Ctrl+Alt+D)">${icon('design', 24)}</button>
  <button id="b-mus" title="Musica">${icon('music_note', 20)}<span class="lb">Musica</span></button><button id="b-pal">${icon('palette', 20)}<span class="lb">Palette</span></button><button id="b-exp" class="light">${icon('export', 20)}<span class="lb">Esporta</span></button>`;
$('#b-mus').onclick = () => musicPop(); $('#b-img').onclick = imagePop; $('#b-note').onclick = addNote; $('#b-el').onclick = elemPop; $('#b-align').onclick = alignPop; $('#b-pres').onclick = () => togglePresent(); $('#b-pen').onclick = () => penToggle(); $('#b-pal').onclick = palettePop; $('#b-exp').onclick = exportPop;
$('#design').onclick = () => aura.toggleDesign();
$('#design').oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); designPop(); };
function toggleCompact() { S.design.compact = !S.design.compact; document.body.classList.toggle('compact', S.design.compact); aura.designOpts(S.design); save(); }
function designPop() {
  const d = S.design, p = showPop(`<div class="pt">Modalità design</div>
    <label class="pr"><span>Trasparenza</span><input type="range" id="d-op" min="30" max="100" value="${Math.round(d.opacity * 100)}"></label>
    <label class="pr"><span>Versione compatta</span><input type="checkbox" id="d-cp" ${d.compact ? 'checked' : ''}></label>
    <label class="pr"><span>Bordo schermo</span><select id="d-dk">${[['none', 'Nessuno'], ['left', 'Sinistra'], ['right', 'Destra'], ['top', 'In alto'], ['bottom', 'In basso']].map(([k, l]) => `<option value="${k}" ${d.dock === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="pr"><span>Nascondi da solo</span><select id="d-ah">${[[0, 'Mai'], [10, 'Dopo 10 s'], [30, 'Dopo 30 s'], [60, 'Dopo 1 min']].map(([k, l]) => `<option value="${k}" ${(d.autohide || 0) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <small class="hint">Ctrl+Alt+H mostra o nasconde l'app da qualsiasi programma. Trasparenza, bordo e nascondi valgono con la modalità attiva. Compatta anche con Ctrl+Alt+C.</small>`, 'design'); if (!p) return;
  const push = () => { aura.designOpts(d); save(); };
  $('#d-op').oninput = (e) => { d.opacity = e.target.value / 100; push(); }; $('#d-cp').onchange = (e) => { if (e.target.checked !== d.compact) toggleCompact(); };
  $('#d-dk').onchange = (e) => { d.dock = e.target.value; push(); }; $('#d-ah').onchange = (e) => { d.autohide = +e.target.value; push(); };
}
aura.onDesign((on) => { $('#design').classList.toggle('active', on); document.body.classList.toggle('design', on); if (on) jingle(); });
document.addEventListener('click', (e) => { $('#ctx').classList.add('hidden'); if (!e.target.closest('#swm,#swbtn')) $('#swm').classList.add('hidden'); if (!e.target.closest('#pop,#toolbar')) closePop(); });

const tb = $('#toolbar'), handle = $('#handle');
handle.addEventListener('pointerdown', (e) => {
  handle.setPointerCapture(e.pointerId);
  const r = tb.getBoundingClientRect(), p = tb.offsetParent.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
  const mv = (m) => { tb.style.left = Math.min(Math.max(0, m.clientX - dx - p.left), p.width - r.width) + 'px'; tb.style.top = Math.min(Math.max(0, m.clientY - dy - p.top), p.height - r.height) + 'px'; tb.style.bottom = 'auto'; closePop(); };
  handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', () => handle.removeEventListener('pointermove', mv), { once: true });
});

/* ---------- Colori dominanti, impostazioni, progetti, risparmio risorse, aggiornamenti ---------- */
const HUES = [['rosso', '#ff4d4d'], ['arancio', '#ff9f43'], ['giallo', '#ffd84d'], ['verde', '#4dd964'], ['azzurro', '#33d6e6'], ['blu', '#3d7bff'], ['viola', '#a96bff'], ['rosa', '#ff7ab6'], ['nero', '#111111'], ['grigio', '#8a8a8a'], ['bianco', '#f2f2f2']];
function hueOf(hex) {
  if (!hex) return null; const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2, sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  if (l < .14) return 'nero'; if (l > .88) return 'bianco'; if (sat < .14) return 'grigio';
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  return h >= 345 || h < 15 ? 'rosso' : h < 45 ? 'arancio' : h < 70 ? 'giallo' : h < 165 ? 'verde' : h < 200 ? 'azzurro' : h < 255 ? 'blu' : h < 300 ? 'viola' : 'rosa';
}
const hueChips = () => `<span class="hues">${HUES.map(([n, c]) => `<b data-h="${n}" class="${q.hue === n ? 'on' : ''}" style="background:${c}" title="${n}"></b>`).join('')}</span>`;
function libMatch(l, qq) { const t = (qq || '').trim().toLowerCase(); const okT = !t || [l.name, (l.tags || []).join(' ')].join(' ').toLowerCase().includes(t); return okT && (!q.hue || hueOf(l.color) === q.hue); }
const libBadges = (l) => (l.lab ? `<i class="lc" style="background:${l.lab}"></i>` : '') + (l.fav ? `<span class="fv">${icon('star_fill1', 16)}</span>` : '') + (l.tags && l.tags.length ? `<span class="tg">${esc(l.tags.slice(0, 2).join(' · '))}</span>` : '');

const ACCENTS = ['#1660FF', '#36DD33', '#FEE685', '#FF7AB6', '#A78BFA', '#FF9F43', '#22D3EE', '#FF5A5F'];
function applySettings() {
  const st = S.settings; document.documentElement.dataset.theme = st.theme === 'light' ? 'light' : 'dark';
  const custom = st.accent && st.accent !== 'auto' && HEX.test(st.accent); document.body.classList.toggle('cacc', !!custom);
  if (custom) document.body.style.setProperty('--accent', st.accent.startsWith('#') ? st.accent : '#' + st.accent); else document.body.style.removeProperty('--accent');
}
function settingsModal() {
  const m = $('#modal'), st = S.settings;
  m.innerHTML = `<div class="panel"><h3>Impostazioni</h3><p>Tema</p><div class="seg" id="s-theme"><button data-v="dark">Scuro</button><button data-v="light">Chiaro</button></div>
    <p>Colore di accento</p><div class="cl" id="s-acc"><b data-k="auto" title="Automatico (blu in Home, verde altrove)">A</b>${ACCENTS.map((k) => `<b data-k="${k}" style="background:${k}"></b>`).join('')}</div>
    <div class="row" style="margin-top:8px"><input class="ti" id="s-hex" maxlength="7" placeholder="Oppure scrivi un HEX, es. #FF6A00"></div>
    <label class="pr" style="margin-top:12px"><span>Risparmio risorse</span><input type="checkbox" id="s-perf" ${st.perf ? 'checked' : ''}></label><small class="hint">Mette in pausa i video che non sono nella parte visibile del canvas.</small>
    <p>Progetti</p><div class="pb"><button id="s-exp">Esporta tutto…</button><button id="s-imp">Importa progetto…</button></div>
    <p>Aggiornamenti</p><div class="pb"><button id="s-upd">Controlla aggiornamenti</button></div><small class="hint" id="s-ver"></small>
    <small class="hint" style="display:block;margin-top:10px">Scorciatoie: Ctrl+Alt+D modalità design · Ctrl+Alt+H mostra/nascondi · Ctrl+Alt+C compatta</small>
    <div class="acts"><button id="mclose">Chiudi</button></div></div>`;
  m.classList.remove('hidden');
  const sync = () => { m.querySelectorAll('#s-theme button').forEach((b) => b.classList.toggle('on', b.dataset.v === st.theme)); m.querySelectorAll('#s-acc b').forEach((b) => b.classList.toggle('on', b.dataset.k === st.accent)); };
  m.querySelectorAll('#s-theme button').forEach((b) => b.onclick = () => { st.theme = b.dataset.v; applySettings(); save(); sync(); });
  m.querySelectorAll('#s-acc b').forEach((b) => b.onclick = () => { st.accent = b.dataset.k; applySettings(); save(); sync(); });
  $('#s-hex').oninput = (e) => { if (HEX.test(e.target.value)) { st.accent = '#' + e.target.value.replace('#', '').toUpperCase(); applySettings(); save(); sync(); } };
  $('#s-perf').onchange = (e) => { st.perf = e.target.checked; save(); if (!st.perf) document.querySelectorAll('.it video').forEach((v) => v.play().catch(() => {})); };
  $('#s-exp').onclick = () => { m.classList.add('hidden'); exportProject('all'); }; $('#s-imp').onclick = () => { m.classList.add('hidden'); importProjectFile(null); };
  aura.version().then((v) => { const e = $('#s-ver'); if (e) e.textContent = 'AURA moodboard · versione ' + v; });
  $('#s-upd').onclick = async () => { const r = await aura.checkUpdates(); toast(r.s === 'disabled' ? 'Gli aggiornamenti automatici non sono attivi in questa copia' : r.s === 'error' ? 'Controllo non riuscito' : 'Controllo in corso…'); };
  $('#mclose').onclick = () => m.classList.add('hidden'); m.onclick = (e) => { if (e.target === m) m.classList.add('hidden'); }; sync();
}
function buildProject(scope, c) {
  if (scope === 'all') return { payload: { library: S.library, folders: S.folders, canvases: S.canvases, templates: S.templates }, files: [...S.library.map((l) => l.file), ...S.canvases.flatMap((x) => (x.tracks || []).flatMap((t) => [t.file, t.cover]))].filter(Boolean) };
  const ids = new Set(c.items.filter((i) => i.kind === 'img').map((i) => i.lib)); if (c.icon && c.icon.type === 'lib') ids.add(c.icon.id);
  const libs = S.library.filter((l) => ids.has(l.id)).map((l) => ({ ...l, folderId: null }));
  return { payload: { library: libs, folders: [], canvases: [{ ...clone(c), folderId: null }] }, files: [...libs.map((l) => l.file), ...(c.tracks || []).flatMap((t) => [t.file, t.cover])].filter(Boolean) };
}
async function exportProject(scope, c) {
  c = c || curCanvas(); const { payload, files } = buildProject(scope, c); toast('Preparo il progetto…');
  if (await aura.exportProject(clone(payload), files, scope === 'all' ? 'AURA-libreria' : c.name)) toast('Progetto esportato');
}
function mergeProject(r) {
  const d = r.data, m = r.map || {}, idMap = {}, fMap = {}, fm = (f) => f ? (m[f] || f) : f;
  (d.folders || []).forEach((f) => { const n = uid(); fMap[f.id] = n; S.folders.push({ ...f, id: n }); });
  (d.library || []).forEach((l) => { const n = uid(); idMap[l.id] = n; S.library.push({ ...l, id: n, file: fm(l.file), folderId: l.folderId ? (fMap[l.folderId] || null) : null }); });
  (d.canvases || []).forEach((c) => {
    const n = clone(c); n.id = uid(); n.folderId = c.folderId ? (fMap[c.folderId] || null) : null; n.items.forEach((i) => { i.id = uid(); if (i.lib) i.lib = idMap[i.lib] || i.lib; });
    if (n.icon && n.icon.type === 'lib') n.icon.id = idMap[n.icon.id] || n.icon.id; (n.tracks || []).forEach((t) => { t.id = uid(); t.file = fm(t.file); t.cover = fm(t.cover); }); S.canvases.push(n);
  });
  (d.templates || []).forEach((t) => S.templates.push({ ...clone(t), id: uid() }));
}
async function importProjectFile(p) {
  toast('Apro il progetto…'); const r = await aura.importProject(p || null).catch(() => ({ error: 'Impossibile aprire il progetto' }));
  if (!r) return; if (r.error) return toast(r.error); mergeProject(r); save(); cur.home = null; setView('home'); toast('Progetto importato');
}
aura.onOpenProject((p) => importProjectFile(p));

// risparmio risorse: mette in pausa i video fuori dalla vista
setInterval(() => {
  if (!S.settings.perf || view !== 'canvas') return; const c = curCanvas(), st = stage(); if (!c || !st) return; const v = vw(), W = st.clientWidth, Hh = st.clientHeight;
  c.items.forEach((it) => {
    if (it.kind !== 'img' || lib(it.lib)?.type !== 'video') return; const el = $(`.it[data-id="${it.id}"] video`, st); if (!el) return; const b = itemBox(it);
    const vis = b.x2 * v.z + v.x > 0 && b.x * v.z + v.x < W && b.y2 * v.z + v.y > 0 && b.y * v.z + v.y < Hh;
    if (!vis && !el.paused) el.pause(); else if (vis && el.paused && !el.ended) el.play().catch(() => {});
  });
}, 500);

// aggiornamenti
function showUpdate(v) {
  let b = $('#upd'); if (!b) { b = document.createElement('div'); b.id = 'upd'; document.body.append(b); }
  b.innerHTML = `<span>Versione ${esc(v)} pronta</span><button id="upd-go">Riavvia e aggiorna</button><button id="upd-x" title="Più tardi">${icon('close', 16)}</button>`;
  $('#upd-go').onclick = () => aura.installUpdate(); $('#upd-x').onclick = () => b.remove();
}
aura.onUpdate((d) => { if (d.s === 'available') toast('Nuova versione ' + d.v + ': la scarico in background'); else if (d.s === 'ready') showUpdate(d.v); else if (d.s === 'none') toast('Hai già l’ultima versione'); else if (d.s === 'error') toast('Aggiornamento non riuscito'); });
{ const gb = document.createElement('button'); gb.id = 'b-set'; gb.title = 'Impostazioni'; gb.innerHTML = icon('settings', 22); gb.onclick = settingsModal; $('#win').prepend(gb); }

(async () => {
  const r = await aura.load(); if (r.state) S = Object.assign(S, r.state);
  S.templates = S.templates || []; S.design = Object.assign({ opacity: 1, compact: false, dock: 'none', autohide: 0 }, S.design); S.settings = Object.assign({ theme: 'dark', accent: 'auto', perf: false }, S.settings); applySettings(); document.body.classList.toggle('compact', S.design.compact); aura.designOpts(S.design);
  bindStage(); setView('home');
})();
