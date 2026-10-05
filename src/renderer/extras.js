/* ===== Livelli, ordine, riquadri, menu rapido, presentazione ===== */
const SVGNS = 'http://www.w3.org/2000/svg';
const LV0 = { b: 0, g: 1, w: 255 };
const lvDefault = (l) => !l || (l.b === 0 && l.w === 255 && Math.abs(l.g - 1) < .005);

/* --- Livelli (ombre, mezzitoni, luci) tramite filtro SVG --- */
function lvDef(it) {
  let defs = document.getElementById('lvdefs');
  if (!defs) { defs = document.createElementNS(SVGNS, 'svg'); defs.id = 'lvdefs'; defs.setAttribute('width', '0'); defs.setAttribute('height', '0'); defs.style.cssText = 'position:absolute;width:0;height:0'; document.body.append(defs); }
  let f = document.getElementById('lv-' + it.id); if (!it.lv) { if (f) f.remove(); return false; }
  if (!f) {
    f = document.createElementNS(SVGNS, 'filter'); f.id = 'lv-' + it.id; f.setAttribute('color-interpolation-filters', 'sRGB');
    for (let k = 0; k < 2; k++) { const t = document.createElementNS(SVGNS, 'feComponentTransfer'); ['R', 'G', 'B'].forEach((ch) => t.append(document.createElementNS(SVGNS, 'feFunc' + ch))); f.append(t); }
    defs.append(f);
  }
  const { b, g, w } = it.lv, t1 = f.children[0], t2 = f.children[1];
  [...t1.children].forEach((n) => { n.setAttribute('type', 'linear'); n.setAttribute('slope', String(255 / (w - b))); n.setAttribute('intercept', String(-b / (w - b))); });
  [...t2.children].forEach((n) => { n.setAttribute('type', 'gamma'); n.setAttribute('amplitude', '1'); n.setAttribute('exponent', String(1 / g)); n.setAttribute('offset', '0'); });
  return true;
}
function applyLv(el, it) { const on = it.kind === 'img' && lvDef(it); el.querySelectorAll('.in img, .in video').forEach((m) => { m.style.filter = on ? `url(#lv-${it.id})` : ''; }); }
function setLevels(items, patch) {
  items.forEach((it) => {
    if (it.kind !== 'img') return; const l = { ...LV0, ...(it.lv || {}), ...patch }; l.b = Math.min(l.b, l.w - 5);
    if (lvDefault(l)) delete it.lv; else it.lv = l; const el = elOf(it.id); if (el) applyLv(el, it); redrawAmb(it);
  });
}

/* --- Ordine dei livelli (davanti / dietro) --- */
function reorder(mode) {
  const c = curCanvas(); if (!c || !sel.length) return; const ids = new Set(sel); let a = c.items;
  const picked = a.filter((i) => ids.has(i.id)), rest = a.filter((i) => !ids.has(i.id));
  if (mode === 'front') a = [...rest, ...picked]; else if (mode === 'back') a = [...picked, ...rest];
  else {
    a = [...a];
    if (mode === 'fwd') { for (let i = a.length - 2; i >= 0; i--) if (ids.has(a[i].id) && !ids.has(a[i + 1].id)) [a[i], a[i + 1]] = [a[i + 1], a[i]]; }
    else for (let i = 1; i < a.length; i++) if (ids.has(a[i].id) && !ids.has(a[i - 1].id)) [a[i], a[i - 1]] = [a[i - 1], a[i]];
  }
  c.items = a; zs(); commit();
}

/* --- Riquadri --- */
const containedIn = (c, fr) => c.items.filter((i) => i !== fr && i.kind !== 'frame' && i.x + i.w / 2 > fr.x && i.x + i.w / 2 < fr.x + fr.w && i.y + i.h / 2 > fr.y && i.y + i.h / 2 < fr.y + fr.h);
function frameFromSelection() {
  const its = selItems().filter((i) => i.kind !== 'frame'); if (!its.length) return; const c = curCanvas(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  its.forEach((i) => { const b = itemBox(i); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x2); y1 = Math.max(y1, b.y2); });
  const pad = 48, fr = { id: uid(), kind: 'frame', text: 'Riquadro ' + (c.items.filter((i) => i.kind === 'frame').length + 1), color: '#FFFFFF', rot: 0, x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
  c.items.unshift(fr); const el = mkItem(fr); el.classList.add('new'); world().append(el); zs(); select([fr.id]); commit();
}

/* --- Pannello proprietà: livelli, ordine, riquadro --- */
function extraHtml(items) {
  const f = items[0].lv || LV0; let h = '';
  if (items.every((i) => i.kind === 'img')) h += `<div class="lv"><div class="lvh"><span>${icon('opacity', 16)}Livelli</span><button class="mini" id="lv-r">Reimposta</button></div>
    <label class="pr"><span>Ombre</span><input type="range" id="lv-b" min="0" max="250" value="${f.b}"></label>
    <label class="pr"><span>Mezzitoni</span><input type="range" id="lv-g" min="30" max="300" value="${Math.round(f.g * 100)}"></label>
    <label class="pr"><span>Luci</span><input type="range" id="lv-w" min="5" max="255" value="${f.w}"></label></div>`;
  h += `<div class="pb ord"><button id="o-front" title="In primo piano (Ctrl+Maiusc+])">In primo piano</button><button id="o-fwd" title="Avanti (Ctrl+])">Avanti</button><button id="o-bwd" title="Indietro (Ctrl+[)">Indietro</button><button id="o-back" title="In secondo piano (Ctrl+Maiusc+[)">In fondo</button></div>`;
  h += `<label class="pr" title="Acceso: angoli in proporzione, Maiusc = libero. Spento: libero, Maiusc = in proporzione"><span>Ridimensiona in proporzione</span><input type="checkbox" id="e-prop" ${S.settings.propResize !== false ? 'checked' : ''}></label>`;
  if (items.length > 1) h += '<button class="pb1" id="o-frame">Crea un riquadro attorno alla selezione</button>';
  return h;
}
function bindExtras(p) {
  const on = (id, fn, ev = 'oninput') => { const e = $(id, p); if (e) e[ev] = fn; };
  on('#lv-b', (e) => { setLevels(selItems(), { b: +e.target.value }); commitSoon(); }); on('#lv-g', (e) => { setLevels(selItems(), { g: e.target.value / 100 }); commitSoon(); }); on('#lv-w', (e) => { setLevels(selItems(), { w: +e.target.value }); commitSoon(); });
  on('#lv-r', () => { selItems().forEach((i) => { delete i.lv; const el = elOf(i.id); if (el) applyLv(el, i); redrawAmb(i); }); commit(); renderProps(); }, 'onclick');
  [['#o-front', 'front'], ['#o-fwd', 'fwd'], ['#o-bwd', 'bwd'], ['#o-back', 'back']].forEach(([id, m]) => on(id, () => reorder(m), 'onclick')); on('#o-frame', frameFromSelection, 'onclick'); on('#e-prop', (e) => { S.settings.propResize = e.target.checked; save(); }, 'onchange');
}

/* --- Menu rapido (clic destro sul canvas) --- */
async function addImageFromDisk() { const en = await ingest(await aura.pick(), null); en.forEach((x) => addImage(x)); }
function toggleTheme() { S.settings.theme = S.settings.theme === 'light' ? 'dark' : 'light'; applySettings(); save(); }
function fitAll() {
  const c = curCanvas(), st = stage(); if (!c.items.length) return; const b = bounds(c), v = vw(), W = st.clientWidth, Hh = st.clientHeight, z = Math.min(4, Math.max(.1, Math.min(W / b.w, Hh / b.h) * .95));
  Object.assign(v, { z, x: W / 2 - (b.x0 + b.w / 2) * z, y: Hh / 2 - (b.y0 + b.h / 2) * z }); st.classList.add('zm'); applyView(); setTimeout(() => st.classList.remove('zm'), 300); save();
}
function quickMenu(e) {
  const c = curCanvas(); if (!c) return; const hit = e.target.closest && e.target.closest('.it'), it = hit && itemOf(hit.dataset.id);
  if (it) { if (!sel.includes(it.id)) select([it.id]); } else select([]);
  const common = [null, ['Ridimensiona in proporzione', toggleProp, 'Maiusc = libero', S.settings.propResize !== false], ['Guide automatiche', toggleGuides, 'Ctrl+U', !!S.settings.guides], ['Presentazione', () => togglePresent(), 'Maiusc+W'], ['Modalità design', () => aura.toggleDesign(), 'Ctrl+Alt+D'], ['Versione compatta', toggleCompact, 'Ctrl+Alt+C', S.design.compact], ['Mostra / nascondi app', () => toast('Da qualsiasi programma: Ctrl+Alt+H'), 'Ctrl+Alt+H'], null,
    ['Tema chiaro', toggleTheme, '', S.settings.theme === 'light'], ['Risparmio risorse', () => { S.settings.perf = !S.settings.perf; save(); toast('Risparmio risorse ' + (S.settings.perf ? 'attivo' : 'disattivo')); }, '', S.settings.perf], ['Impostazioni…', settingsModal, '']];
  const items = it ? [
    ['Copia', () => copySel(), 'Ctrl+C'], ['Taglia', () => { if (copySel()) deleteSel(); }, 'Ctrl+X'], ['Incolla', paste, 'Ctrl+V'], ['Duplica', duplicateSel, 'Ctrl+D'], ['Elimina', deleteSel, 'Canc'], null,
    ['In primo piano', () => reorder('front'), 'Ctrl+Maiusc+]'], ['Avanti', () => reorder('fwd'), 'Ctrl+]'], ['Indietro', () => reorder('bwd'), 'Ctrl+['], ['In secondo piano', () => reorder('back'), 'Ctrl+Maiusc+['],
    ...(sel.length === 1 && it.kind === 'img' ? [null, ['Ritaglia', toggleCrop, 'Doppio clic']] : []), ...(sel.length === 1 && (it.kind === 'shape' || it.kind === 'path') ? [null, ['Modifica punti', () => pteEnter(it), 'Doppio clic']] : []), ...(sel.length > 1 ? [null, ['Crea riquadro', frameFromSelection], ['Allinea selezione', () => align()]] : []), ...common
  ] : [
    ['Incolla', paste, 'Ctrl+V'], ['Seleziona tutto', () => select(c.items.map((i) => i.id)), 'Ctrl+A'], ['Annulla', undo, 'Ctrl+Z'], ['Ripristina', redo, 'Ctrl+Alt+Z'], null,
    ['Aggiungi immagine…', addImageFromDisk], ['Aggiungi nota', addNote], ['Aggiungi testo', () => addElement('text')], ['Aggiungi riquadro', () => addElement('frame')], ['Penna', penToggle, 'P'], ['Allinea immagini', () => align()], null,
    ['Adatta tutto alla vista', fitAll], ['Zoom 100%', () => $('#zoomlbl').onclick()], ['Musica…', () => musicPop()], ['Esporta…', () => exportPop()], ...common
  ];
  menu(e, items);
}

/* --- Presentazione: per riquadri o immagine per immagine --- */
const PRES = { on: false, mode: 'items', stops: [], i: 0, prev: null, ah: null };
const readingOrder = (a, b) => { const ya = a.y + a.h / 2, yb = b.y + b.h / 2, row = Math.max(60, Math.min(a.h, b.h) * .6); return Math.abs(ya - yb) > row ? ya - yb : a.x - b.x; };
function presentStops(mode) {
  const c = curCanvas(), num = (t) => { const m = /^\s*(\d+)/.exec(t || ''); return m ? +m[1] : null; };
  const list = mode === 'frames' ? c.items.filter((i) => i.kind === 'frame').sort((a, b) => (num(a.text) != null && num(b.text) != null && num(a.text) !== num(b.text)) ? num(a.text) - num(b.text) : readingOrder(a, b)) : c.items.filter((i) => i.kind === 'img').sort(readingOrder);
  const all = bounds(c), boxOf = (i) => { const q = itemBox(i); return { x: q.x, y: q.y, w: q.x2 - q.x, h: q.y2 - q.y }; };
  return [{ box: { x: all.x0, y: all.y0, w: all.w, h: all.h } }, ...list.map((i) => ({ box: boxOf(i) }))];
}
function gotoStop(i, instant) {
  const st = stage(), s = PRES.stops[i]; if (!s) return; PRES.i = i; const W = st.clientWidth, Hh = st.clientHeight, b = s.box, v = vw();
  const z = Math.min(4, Math.max(.05, Math.min(W / b.w, Hh / b.h) * (i === 0 ? .94 : .86)));
  if (!instant) st.classList.add('pt'); Object.assign(v, { z, x: W / 2 - (b.x + b.w / 2) * z, y: Hh / 2 - (b.y + b.h / 2) * z }); applyView(); if (instant) st.classList.remove('pt');
  const ind = $('#pind'); if (ind) { ind.textContent = `${i + 1} / ${PRES.stops.length}`; ind.classList.add('vis'); clearTimeout(ind._t); ind._t = setTimeout(() => ind.classList.remove('vis'), 1600); }
}
const presentStep = (d) => { const n = PRES.i + d; if (n >= 0 && n < PRES.stops.length) gotoStop(n); };
const presentClick = (e) => { if (e.button === 0) presentStep(1); };
function markPres() { document.querySelectorAll('#pp button').forEach((b) => b.classList.toggle('on', b.dataset.m === PRES.mode)); }
function setPresentMode(mode) {
  const c = curCanvas(); if (mode === 'frames' && !c.items.some((i) => i.kind === 'frame')) return toast('Crea almeno un riquadro (Elemento, Riquadro) per presentare per riquadri');
  if (mode === 'items' && !c.items.some((i) => i.kind === 'img')) return toast('Nel canvas non ci sono immagini');
  PRES.mode = mode; PRES.stops = presentStops(mode); markPres(); gotoStop(0);
}
function buildPresPanel() {
  if ($('#pp')) return; const pp = document.createElement('div'), ind = document.createElement('div'), ex = document.createElement('button');
  pp.id = 'pp'; pp.className = 'ah'; pp.innerHTML = `<button data-m="frames">${icon('select_all', 20)}<span>Per riquadri</span></button><button data-m="items">${icon('image', 20)}<span>Immagine per immagine</span></button>`;
  ind.id = 'pind'; ind.className = 'ah'; ex.id = 'pexit'; ex.className = 'ah'; ex.title = 'Esci dalla presentazione (Esc)'; ex.innerHTML = icon('close', 20); ex.onclick = (e) => { e.stopPropagation(); endPresent(); }; document.body.append(pp, ind, ex);
  pp.querySelectorAll('button').forEach((b) => b.onclick = (e) => { e.stopPropagation(); setPresentMode(b.dataset.m); }); PRES.ah = autoHide(pp, { when: () => PRES.on }); PRES.ahx = autoHide(ex, { when: () => PRES.on });
}
function startPresent() {
  if (view !== 'canvas' || PRES.on) return; const c = curCanvas(); if (!c.items.some((i) => i.kind === 'img' || i.kind === 'frame')) return toast('Aggiungi immagini o riquadri per presentare');
  closePop(); select([]); $('#ctx').classList.add('hidden'); PRES.on = true; PRES.prev = { ...vw() }; document.body.classList.add('present'); aura.fullscreen(true); buildPresPanel();
  PRES.mode = c.items.some((i) => i.kind === 'frame') ? 'frames' : 'items'; PRES.stops = presentStops(PRES.mode); markPres(); PRES.ah.reveal(); PRES.ahx.reveal(); toast('Per uscire: Esc, Maiusc+W o la X in alto a destra');
  setTimeout(() => { if (PRES.on) gotoStop(0, true); }, 300); gotoStop(0, true);
}
function endPresent() {
  if (!PRES.on) return; PRES.on = false; document.body.classList.remove('present'); document.querySelectorAll('#pp,#pind,#pexit').forEach((n) => n.classList.remove('vis')); aura.fullscreen(false); const st = stage(); st.classList.remove('pt');
  if (PRES.prev) Object.assign(vw(), PRES.prev); applyView(); setTimeout(applyView, 350);
}
const togglePresent = () => (PRES.on ? endPresent() : startPresent());
addEventListener('resize', () => { if (PRES.on) gotoStop(PRES.i, true); });

/* --- Scorciatoie (fase di cattura: hanno la precedenza) --- */
document.addEventListener('keydown', (e) => {
  if (editing()) return;
  if (PRES.on) {
    const k = e.key;
    if (k === 'Escape' || (e.shiftKey && e.code === 'KeyW')) endPresent(); else if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) presentStep(1);
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) presentStep(-1); else if (k === 'Home') gotoStop(0); else if (k === 'End') gotoStop(PRES.stops.length - 1);
    else if (k === '1') setPresentMode('frames'); else if (k === '2') setPresentMode('items');
    e.preventDefault(); e.stopImmediatePropagation(); return;
  }
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.shiftKey && !ctrl && !e.altKey && /^Digit[1-9]$/.test(e.code)) { const cv = canvasOrder()[+e.code.slice(5) - 1]; if (cv) { e.preventDefault(); e.stopImmediatePropagation(); openCanvas(cv.id); } return; }
  if (view === 'canvas') {
    if (ctrl && !e.shiftKey && !e.altKey && e.code === 'KeyU') { e.preventDefault(); e.stopImmediatePropagation(); toggleGuides(); return; }
    if (e.shiftKey && !ctrl && !e.altKey && e.code === 'KeyW') { e.preventDefault(); e.stopImmediatePropagation(); startPresent(); return; }
    if (ctrl && (e.code === 'BracketRight' || e.code === 'BracketLeft')) { e.preventDefault(); e.stopImmediatePropagation(); reorder(e.code === 'BracketRight' ? (e.shiftKey ? 'front' : 'fwd') : (e.shiftKey ? 'back' : 'bwd')); }
  }
}, true);

/* --- Pannellino a scomparsa: visibile con il mouse vicino, sparisce dopo 3 secondi --- */
function autoHide(el, opts = {}) {
  const delay = opts.delay ?? 3000, margin = opts.margin ?? 90, when = opts.when || (() => true); let t = null;
  const hide = () => { if (el.matches(':hover')) { t = setTimeout(hide, delay); return; } el.classList.remove('vis'); };
  const reveal = () => { el.classList.add('vis'); clearTimeout(t); t = setTimeout(hide, delay); };
  el.addEventListener('pointerenter', () => { clearTimeout(t); el.classList.add('vis'); });
  el.addEventListener('pointerleave', () => { clearTimeout(t); t = setTimeout(hide, delay); });
  const near = (e) => { if (!when()) return; const r = el.getBoundingClientRect(); if (e.clientX > r.left - margin && e.clientX < r.right + margin && e.clientY > r.top - margin && e.clientY < r.bottom + margin) reveal(); };
  document.addEventListener('pointermove', near); document.addEventListener('pointerdown', near, true);
  return { reveal, hide };
}

/* --- Allinea: ordine a scelta (lettura, selezione, nome, aggiunta, colore, dimensione, casuale, manuale) --- */
const colKey = (hex) => { if (!hex) return 999; const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2, sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0; if (sat < .14 || l < .14 || l > .88) return 400 + l * 100; let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return h * 60; };
function alignSort(pool, mode, rev) {
  const l = [...pool], en = (i) => lib(i.lib) || {}, read = (a, b) => (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x, so = (i) => { const k = sel.indexOf(i.id); return k < 0 ? 1e9 : k; };
  const cmp = { read, sel: (a, b) => so(a) - so(b) || read(a, b), name: (a, b) => String(en(a).name || '').localeCompare(String(en(b).name || ''), 'it', { numeric: true }), date: (a, b) => S.library.indexOf(en(a)) - S.library.indexOf(en(b)), size: (a, b) => b.w * b.h - a.w * a.h, color: (a, b) => colKey(en(a).color) - colKey(en(b).color) || read(a, b) }[mode];
  if (mode === 'rand') for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } else if (cmp) l.sort(cmp); else l.sort(read);
  return rev ? l.reverse() : l;
}
function fitLayout(pool, mode, W, Hm, gap) { // calcola le posizioni (relative) per ogni disposizione, ingrandendo finché entra nella vista
  const asp = pool.map((i) => i.w / i.h), n = pool.length;
  const L = {
    rows: (S) => { const ws = asp.map((a) => a * S), rows = []; let row = [], rw = 0; ws.forEach((w, k) => { if (row.length && rw + gap + w > W) { rows.push(row); row = []; rw = 0; } rw += (row.length ? gap : 0) + w; row.push(k); }); rows.push(row);
      const wid = rows.map((r) => r.reduce((s, k) => s + ws[k], 0) + (r.length - 1) * gap), tw = Math.max(...wid), rects = []; let y = 0; rows.forEach((r, ri) => { let x = (tw - wid[ri]) / 2; r.forEach((k) => { rects[k] = { x, y, w: ws[k], h: S }; x += ws[k] + gap; }); y += S + gap; }); return { rects, w: tw, h: y - gap }; },
    row: (S) => { let x = 0; const rects = asp.map((a) => { const q = { x, y: 0, w: a * S, h: S }; x += a * S + gap; return q; }); return { rects, w: x - gap, h: S }; },
    col: (S) => { let y = 0; const rects = asp.map((a) => { const q = { x: 0, y, w: S, h: S / a }; y += S / a + gap; return q; }); return { rects, w: S, h: y - gap }; },
    grid: (S) => { const cols = Math.max(1, Math.floor((W + gap) / (S + gap))), rn = Math.ceil(n / cols), used = Math.min(cols, n);
      const rects = pool.map((_, k) => { const a = asp[k], w = a >= 1 ? S : S * a, h = a >= 1 ? S / a : S, cx = (k % cols) * (S + gap) + S / 2, cy = Math.floor(k / cols) * (S + gap) + S / 2; return { x: cx - w / 2, y: cy - h / 2, w, h }; }); return { rects, w: used * S + (used - 1) * gap, h: rn * S + (rn - 1) * gap }; },
    masonry: (S) => { const cols = Math.max(1, Math.floor((W + gap) / (S + gap))), hs = Array(cols).fill(0), rects = []; pool.forEach((_, k) => { let c = 0; hs.forEach((h, i) => { if (h < hs[c]) c = i; }); rects[k] = { x: c * (S + gap), y: hs[c], w: S, h: S / asp[k] }; hs[c] += S / asp[k] + gap; }); const used = Math.min(cols, n); return { rects, w: used * S + (used - 1) * gap, h: Math.max(...hs) - gap }; }
  }, f = L[mode] || L.rows; let r;
  for (let S = 360; S >= 50; S -= 10) { r = f(S); if (r.w <= W && r.h <= Hm) return r; }
  return r;
}
function alignEdges(kind) { // allinea i bordi / distribuisce gli elementi selezionati
  const its = selItems().filter((i) => i.kind !== 'frame'); if (its.length < 2) return toast('Seleziona almeno due elementi');
  if ((kind === 'dh' || kind === 'dv') && its.length < 3) return toast('Per distribuire servono almeno tre elementi');
  const bx = its.map(itemBox), Lf = Math.min(...bx.map((q) => q.x)), R = Math.max(...bx.map((q) => q.x2)), T = Math.min(...bx.map((q) => q.y)), B = Math.max(...bx.map((q) => q.y2));
  if (kind === 'dh' || kind === 'dv') {
    const hor = kind === 'dh', ord = its.map((it, k) => ({ it, q: bx[k] })).sort((a, b) => hor ? a.q.x - b.q.x : a.q.y - b.q.y), size = (o) => hor ? o.q.x2 - o.q.x : o.q.y2 - o.q.y;
    const gap = ((hor ? R - Lf : B - T) - ord.reduce((s, o) => s + size(o), 0)) / (ord.length - 1); let pos = hor ? Lf : T;
    ord.forEach((o) => { const d = pos - (hor ? o.q.x : o.q.y); if (hor) o.it.x += d; else o.it.y += d; pos += size(o) + gap; });
  } else its.forEach((it, k) => { const q = bx[k]; if (kind === 'l') it.x += Lf - q.x; else if (kind === 'r') it.x += R - q.x2; else if (kind === 'c') it.x += (Lf + R) / 2 - (q.x + q.x2) / 2; else if (kind === 't') it.y += T - q.y; else if (kind === 'b') it.y += B - q.y2; else if (kind === 'm') it.y += (T + B) / 2 - (q.y + q.y2) / 2; });
  const st = stage(); st.classList.add('anim'); its.forEach((i) => applyTf(elOf(i.id), i)); updateBg(); commit(); setTimeout(() => st.classList.remove('anim'), 450);
}
function alignPop() {
  const pool = alignPool(); if (!pool.length) return toast('Nessun elemento da allineare');
  const modes = [['read', 'Lettura'], ['sel', 'Selezione'], ['name', 'Nome'], ['date', 'Aggiunta'], ['color', 'Colore'], ['size', 'Dimensione'], ['rand', 'Casuale']], lays = [['rows', 'Righe'], ['grid', 'Griglia'], ['masonry', 'Cascata'], ['row', 'Riga unica'], ['col', 'Colonna']], gaps = [['s', 'Stretto'], ['n', 'Normale'], ['l', 'Ampio']];
  const edges = [['l', 'Sinistra'], ['c', 'Centro'], ['r', 'Destra'], ['t', 'Alto'], ['m', 'Metà'], ['b', 'Basso'], ['dh', 'Distribuisci ↔'], ['dv', 'Distribuisci ↕']];
  let mode = S.settings.alignMode || 'read', rev = !!S.settings.alignRev, list = alignSort(pool, mode, rev), drag = null;
  const chips = (arr, key) => `<div class="ach" data-k="${key}">${arr.map(([k, l]) => `<button data-v="${k}">${l}</button>`).join('')}</div>`;
  const p = showPop(`<div class="ap"><div class="aph">Disposizione</div>${chips(lays, 'lay')}<div class="aph">Spazio tra le foto</div>${chips(gaps, 'gap')}
    <div class="aph">Ordine</div><div class="ach" data-k="mode">${modes.map(([k, l]) => `<button data-v="${k}">${l}</button>`).join('')}<button data-v="manual" id="ap-man">Manuale</button></div>
    <label class="ark"><input type="checkbox" id="ap-rev"> Inverti l’ordine</label><div class="ath"></div><div class="aphint">Trascina le miniature per scegliere tu l’ordine</div>
    ${sel.length > 1 ? `<div class="aph">Allinea i bordi della selezione</div><div class="ach" data-k="edge">${edges.map(([k, l]) => `<button data-v="${k}">${l}</button>`).join('')}</div>` : ''}
    <button class="go wide" id="ap-go">Allinea</button></div>`, 'align'); if (!p) return;
  const box = $('.ath', p), mark = () => { p.querySelectorAll('.ach[data-k="lay"] button').forEach((b) => b.classList.toggle('on', b.dataset.v === (S.settings.alignLay || 'rows'))); p.querySelectorAll('.ach[data-k="gap"] button').forEach((b) => b.classList.toggle('on', b.dataset.v === (S.settings.alignGap || 'n'))); p.querySelectorAll('.ach[data-k="mode"] button').forEach((b) => b.classList.toggle('on', b.dataset.v === mode)); }, draw = () => {
    mark(); $('#ap-man').style.display = mode === 'manual' ? '' : 'none'; $('#ap-rev').checked = rev;
    box.innerHTML = list.map((i, k) => { const e = lib(i.lib); return `<div class="at" draggable="true" data-id="${i.id}"><b>${k + 1}</b>${e ? mediaEl(e) : ''}</div>`; }).join('');
    box.querySelectorAll('.at').forEach((t) => {
      t.ondragstart = (ev) => { drag = t.dataset.id; ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', drag); } catch {} t.classList.add('dg'); }; t.ondragend = () => t.classList.remove('dg');
      t.ondragover = (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; };
      t.ondrop = (ev) => { ev.preventDefault(); ev.stopPropagation(); const a = list.findIndex((i) => i.id === drag), b = list.findIndex((i) => i.id === t.dataset.id); if (a < 0 || a === b) return; const [m] = list.splice(a, 1); list.splice(b, 0, m); mode = 'manual'; draw(); };
    });
  };
  p.querySelectorAll('.ach[data-k="lay"] button').forEach((b) => b.onclick = () => { S.settings.alignLay = b.dataset.v; save(); mark(); });
  p.querySelectorAll('.ach[data-k="gap"] button').forEach((b) => b.onclick = () => { S.settings.alignGap = b.dataset.v; save(); mark(); });
  p.querySelectorAll('.ach[data-k="mode"] button').forEach((b) => b.onclick = () => { if (b.dataset.v === 'manual') return; mode = b.dataset.v; list = alignSort(pool, mode, rev); S.settings.alignMode = mode; save(); draw(); });
  p.querySelectorAll('.ach[data-k="edge"] button').forEach((b) => b.onclick = () => alignEdges(b.dataset.v));
  $('#ap-rev').onchange = (e) => { rev = e.target.checked; S.settings.alignRev = rev; save(); if (mode === 'manual') list.reverse(); else list = alignSort(pool, mode, rev); draw(); };
  $('#ap-go').onclick = () => { closePop(); align(list); }; draw();
}

/* --- Trasformazione di gruppo: selezione multipla con maniglie per ridimensionare e ruotare --- */
function groupBox(its) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; its.forEach((i) => { const q = itemBox(i); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x2); y1 = Math.max(y1, q.y2); }); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
function buildGBox() {
  const old = document.getElementById('gbox'); if (old) old.remove(); if (selItems().length < 2) return;
  const g = document.createElement('div'); g.id = 'gbox'; g.innerHTML = ['-1,-1', '1,-1', '-1,1', '1,1'].map((k) => `<i class="gh" data-c="${k}"></i>`).join('') + '<i class="gr"></i>'; world().append(g); updateGBox();
}
function updateGBox() {
  const g = document.getElementById('gbox'); if (!g) return; const its = selItems(); if (its.length < 2) { g.remove(); return; }
  const b = groupBox(its); Object.assign(g.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
}
function groupTransform(e, h) {
  const st = stage(), v = vw(), r = st.getBoundingClientRect(), its = selItems(), o = its.map((i) => ({ ...i })), b = groupBox(its), C = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const P = (ev) => ({ x: (ev.clientX - r.left - v.x) / v.z, y: (ev.clientY - r.top - v.y) / v.z }); let fn;
  if (h.classList.contains('gr')) { // ruota tutto attorno al centro (Maiusc = scatti da 15°)
    const a0 = Math.atan2(P(e).y - C.y, P(e).x - C.x);
    fn = (ev) => { const p = P(ev); let d = (Math.atan2(p.y - C.y, p.x - C.x) - a0) * 180 / Math.PI; if (ev.shiftKey) d = Math.round(d / 15) * 15; const t = d * Math.PI / 180, co = Math.cos(t), si = Math.sin(t);
      its.forEach((it, k) => { const q = o[k], dx = q.x + q.w / 2 - C.x, dy = q.y + q.h / 2 - C.y, cx = C.x + dx * co - dy * si, cy = C.y + dx * si + dy * co; it.x = cx - it.w / 2; it.y = cy - it.h / 2; it.rot = (q.rot || 0) + d; }); };
  } else { // ridimensiona rispetto all'angolo opposto: in proporzione, oppure libero (Maiusc, o sempre se la proporzione è spenta)
    const [sx, sy] = h.dataset.c.split(',').map(Number), A = { x: sx > 0 ? b.x : b.x + b.w, y: sy > 0 ? b.y : b.y + b.h }, D = { x: (sx > 0 ? b.x + b.w : b.x) - A.x || 1, y: (sy > 0 ? b.y + b.h : b.y) - A.y || 1 }, minD = Math.min(...o.map((i) => i.kind === 'line' ? i.w : Math.min(i.w, i.h))), lim = Math.max(24 / minD, .02);
    fn = (ev) => {
      const p = P(ev), free = (S.settings.propResize !== false) === !!ev.shiftKey, s = Math.max(((p.x - A.x) * D.x + (p.y - A.y) * D.y) / (D.x * D.x + D.y * D.y), lim), fx = free ? Math.max((p.x - A.x) / D.x, lim) : s, fy = free ? Math.max((p.y - A.y) / D.y, lim) : s;
      its.forEach((it, k) => {
        const q = o[k], rm = (((q.rot || 0) % 180) + 180) % 180, kx = !free ? s : rm === 0 ? fx : rm === 90 ? fy : Math.sqrt(fx * fy), ky = !free ? s : rm === 0 ? fy : rm === 90 ? fx : Math.sqrt(fx * fy);
        const cx = A.x + (q.x + q.w / 2 - A.x) * fx, cy = A.y + (q.y + q.h / 2 - A.y) * fy; it.w = q.w * kx; it.h = q.kind === 'line' ? q.h : q.h * ky; it.x = cx - it.w / 2; it.y = cy - it.h / 2; if (q.kind === 'text') it.fs = Math.max(6, Math.round(q.fs * (kx + ky) / 2));
      });
    };
  }
  try { st.setPointerCapture(e.pointerId); } catch {}
  const mv = (ev) => { fn(ev); its.forEach((it) => { const el = elOf(it.id); if (!el) return; if (it.kind === 'text') fillIn(el, it); applyTf(el, it); }); updateBg(); };
  st.addEventListener('pointermove', mv); st.addEventListener('pointerup', () => { st.removeEventListener('pointermove', mv); commit(); }, { once: true });
}

/* --- Maiusc mentre sposti: movimento dritto + calamita sui bordi e centri degli altri elementi --- */
function snapBoth(group, o0, dx, dy, thr, only) { // calamita su bordi e centri degli altri elementi; 'only' limita a un asse
  const ids = new Set(group.map((g) => g.id)), others = curCanvas().items.filter((it) => !ids.has(it.id)).map(itemBox); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  group.forEach((g, i) => { const q = itemBox({ ...g, x: o0[i].x, y: o0[i].y }); x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x2); y1 = Math.max(y1, q.y2); });
  const xs = (a, b) => [a, (a + b) / 2, b], best = (mine, key) => { let d0 = null; others.forEach((q) => xs(q[key[0]], q[key[1]]).forEach((t) => mine.forEach((m) => { const d = t - m; if (Math.abs(d) <= thr && (d0 === null || Math.abs(d) < Math.abs(d0))) d0 = d; }))); return d0 || 0; };
  const sx = only === 'y' ? 0 : best(xs(x0 + dx, x1 + dx), ['x', 'x2']), sy = only === 'x' ? 0 : best(xs(y0 + dy, y1 + dy), ['y', 'y2']), ndx = dx + sx, ndy = dy + sy;
  const nb = { x: x0 + ndx, x2: x1 + ndx, y: y0 + ndy, y2: y1 + ndy }, vx = new Map(), hy = new Map(), mx = xs(nb.x, nb.x2), my = xs(nb.y, nb.y2), key = (n) => Math.round(n * 100);
  others.forEach((q) => { xs(q.x, q.x2).forEach((t) => { if (mx.some((m) => Math.abs(m - t) < .5)) { const o = vx.get(key(t)) || { p: t, a: nb.y, b: nb.y2 }; o.a = Math.min(o.a, q.y); o.b = Math.max(o.b, q.y2); vx.set(key(t), o); } });
    xs(q.y, q.y2).forEach((t) => { if (my.some((m) => Math.abs(m - t) < .5)) { const o = hy.get(key(t)) || { p: t, a: nb.x, b: nb.x2 }; o.a = Math.min(o.a, q.x); o.b = Math.max(o.b, q.x2); hy.set(key(t), o); } }); });
  return { dx: ndx, dy: ndy, g: [...[...vx.values()].map((o) => ({ v: true, ...o })), ...[...hy.values()].map((o) => ({ v: false, ...o }))] };
}
const snapMove = (group, o0, dx, dy, axis, thr) => snapBoth(group, o0, dx, dy, thr, axis);
function toggleProp() { S.settings.propResize = S.settings.propResize === false; save(); toast(S.settings.propResize === false ? 'Ridimensionamento libero (Maiusc = in proporzione)' : 'Ridimensionamento in proporzione (Maiusc = libero)'); }
function toggleGuides() { S.settings.guides = !S.settings.guides; save(); toast(S.settings.guides ? 'Guide automatiche attive (Ctrl+U per spegnerle)' : 'Guide automatiche disattivate'); }
function showGuides(gs, z) { gs.forEach((g) => { const d = document.createElement('div'), th = 1.5 / z; d.className = 'gd'; Object.assign(d.style, g.v ? { left: g.p - th / 2 + 'px', top: g.a + 'px', width: th + 'px', height: g.b - g.a + 'px' } : { top: g.p - th / 2 + 'px', left: g.a + 'px', height: th + 'px', width: g.b - g.a + 'px' }); world().append(d); }); }
function guidesOff() { document.querySelectorAll('#world .gd').forEach((n) => n.remove()); }
function drawLv(g, it) { g.filter = it.lv ? `url(#lv-${it.id})` : 'none'; return g; }
