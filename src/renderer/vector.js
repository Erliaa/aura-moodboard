/* ===== Forme modificabili punto per punto e strumento penna ===== */
const PEN = { on: false, pts: [], cur: null }, PTE = { on: false, id: null, pts: [], closed: true, sel: 0 }, KAPPA = 0.5523;
const wpt = (ev) => { const r = stage().getBoundingClientRect(), v = vw(); return { x: (ev.clientX - r.left - v.x) / v.z, y: (ev.clientY - r.top - v.y) / v.z }; };
const f2 = (n) => +n.toFixed(2);

/* geometria: i punti sono normalizzati (0..1) nel riquadro dell'elemento; ix/iy e ox/oy sono le maniglie di curva (entrata/uscita) */
function dOf(P, closed, mx, my) {
  if (!P.length) return ''; let d = `M${f2(P[0].x * mx)} ${f2(P[0].y * my)}`; const n = P.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) { const a = P[i], b = P[(i + 1) % n]; if (!a.ox && !a.oy && !b.ix && !b.iy) d += `L${f2(b.x * mx)} ${f2(b.y * my)}`; else d += `C${f2((a.x + (a.ox || 0)) * mx)} ${f2((a.y + (a.oy || 0)) * my)} ${f2((b.x + (b.ix || 0)) * mx)} ${f2((b.y + (b.iy || 0)) * my)} ${f2(b.x * mx)} ${f2(b.y * my)}`; }
  return d + (closed ? 'Z' : '');
}
const pathD = (it) => dOf(it.pts || [], it.closed !== false, it.w, it.h);
function pathSvg(it) {
  const sw = it.sw || 0, d = pathD(it), fill = it.closed !== false && !it.nofill ? it.color : 'none';
  return `<svg class="pth" viewBox="0 0 ${it.w} ${it.h}" preserveAspectRatio="none"><path class="pf" d="${d}" fill="${fill}" stroke="${sw ? it.stroke || '#E3E3E3' : 'none'}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/><path class="hitp" d="${d}" fill="none" stroke="transparent" stroke-width="${Math.max(sw, 14)}"/></svg>`;
}
function updatePathSvg(el, it) { const s = $('.pth', el); if (!s) return; s.setAttribute('viewBox', `0 0 ${it.w} ${it.h}`); const d = pathD(it); s.querySelectorAll('path').forEach((p) => p.setAttribute('d', d)); }
function shapeToPath(it) { // rettangolo (anche con angoli arrotondati) o ellisse -> tracciato modificabile
  const k = KAPPA, mk = (x, y, ix = 0, iy = 0, ox = 0, oy = 0) => ({ x, y, ix, iy, ox, oy }); let pts;
  if (it.shape === 'ellipse') pts = [mk(.5, 0, -k * .5, 0, k * .5, 0), mk(1, .5, 0, -k * .5, 0, k * .5), mk(.5, 1, k * .5, 0, -k * .5, 0), mk(0, .5, 0, k * .5, 0, -k * .5)];
  else {
    const r = Math.min((it.rad || 0) / 100 * Math.min(it.w, it.h), Math.min(it.w, it.h) / 2), rx = r / it.w, ry = r / it.h;
    pts = r > .5 ? [mk(0, ry, 0, 0, 0, -k * ry), mk(rx, 0, -k * rx, 0, 0, 0), mk(1 - rx, 0, 0, 0, k * rx, 0), mk(1, ry, 0, -k * ry, 0, 0), mk(1, 1 - ry, 0, 0, 0, k * ry), mk(1 - rx, 1, k * rx, 0, 0, 0), mk(rx, 1, 0, 0, -k * rx, 0), mk(0, 1 - ry, 0, k * ry, 0, 0)] : [mk(0, 0), mk(1, 0), mk(1, 1), mk(0, 1)];
  }
  it.kind = 'path'; it.pts = pts; it.closed = true; it.stroke = it.stroke || '#E3E3E3'; it.sw = it.sw || 0; delete it.shape; delete it.rad;
}
function toWorld(it) {
  const a = (it.rot || 0) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), cx = it.x + it.w / 2, cy = it.y + it.h / 2, rt = (dx, dy) => [dx * co - dy * si, dx * si + dy * co];
  return it.pts.map((p) => { const [wx, wy] = rt(p.x * it.w - it.w / 2, p.y * it.h - it.h / 2), [ix, iy] = rt((p.ix || 0) * it.w, (p.iy || 0) * it.h), [ox, oy] = rt((p.ox || 0) * it.w, (p.oy || 0) * it.h); return { x: cx + wx, y: cy + wy, ix, iy, ox, oy }; });
}
function fromWorld(it, P, closed) { // ricalcola riquadro e punti normalizzati a partire dai punti nel mondo
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const ext = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }, n = P.length, segs = closed ? n : n - 1;
  P.forEach((p) => ext(p.x, p.y));
  for (let i = 0; i < segs; i++) { const a = P[i], b = P[(i + 1) % n]; if (!a.ox && !a.oy && !b.ix && !b.iy) continue; const c1 = { x: a.x + a.ox, y: a.y + a.oy }, c2 = { x: b.x + b.ix, y: b.y + b.iy };
    for (let k = 1; k < 24; k++) { const t = k / 24, u = 1 - t; ext(u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x, u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y); } }
  const w = Math.max(x1 - x0, 1), h = Math.max(y1 - y0, 1); Object.assign(it, { x: x0, y: y0, w, h, rot: 0, closed });
  it.pts = P.map((p) => ({ x: (p.x - x0) / w, y: (p.y - y0) / h, ix: p.ix / w, iy: p.iy / h, ox: p.ox / w, oy: p.oy / h }));
}
function splitSeg(a, b, t) { // spezza un lato in t (de Casteljau) mantenendo la forma
  const c1 = { x: a.x + (a.ox || 0), y: a.y + (a.oy || 0) }, c2 = { x: b.x + (b.ix || 0), y: b.y + (b.iy || 0) }, L = (p, q) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const p01 = L(a, c1), p12 = L(c1, c2), p23 = L(c2, b), p012 = L(p01, p12), p123 = L(p12, p23), m = L(p012, p123);
  return { m, aOut: [p01.x - a.x, p01.y - a.y], mIn: [p012.x - m.x, p012.y - m.y], mOut: [p123.x - m.x, p123.y - m.y], bIn: [p23.x - b.x, p23.y - b.y] };
}

/* ---- modifica dei punti (doppio clic su una forma o un tracciato) ---- */
function pteEnter(it) {
  if (PEN.on) penOff(); if (PTE.on) pteExit(); if (it.kind === 'shape') shapeToPath(it); if (it.kind !== 'path') return;
  refresh(it); PTE.on = true; PTE.id = it.id; PTE.closed = it.closed !== false; PTE.pts = toWorld(it); PTE.sel = 0; const el = elOf(it.id); if (el) el.style.visibility = 'hidden';
  select([it.id]); commit(); pteDraw(); toast('Trascina punti e lati · doppio clic su un lato aggiunge un punto · Canc toglie il punto · Esc per finire');
}
function pteKill() { PTE.on = false; const ov = document.getElementById('pte'); if (ov) ov.remove(); const el = elOf(PTE.id); if (el) el.style.visibility = ''; }
function pteExit() { if (!PTE.on) return; const it = itemOf(PTE.id); pteKill(); if (it) { refresh(it); select([it.id]); commit(); } }
function pteSync() { const it = itemOf(PTE.id); if (!it) return; fromWorld(it, PTE.pts, PTE.closed); const el = elOf(it.id); if (el) applyTf(el, it); }
function pteDraw() {
  const it = PTE.on && itemOf(PTE.id); if (!it) { if (PTE.on) pteKill(); return; } const u = 1 / vw().z, P = PTE.pts, n = P.length, segs = PTE.closed ? n : n - 1;
  let ov = document.getElementById('pte'); if (!ov) { ov = document.createElementNS(SVGNS, 'svg'); ov.id = 'pte'; world().append(ov); }
  const d = dOf(P, PTE.closed, 1, 1); let h = `<path d="${d}" fill="${PTE.closed && !it.nofill ? it.color : 'none'}" stroke="${it.sw ? it.stroke || '#E3E3E3' : 'none'}" stroke-width="${it.sw || 0}" stroke-linejoin="round" stroke-linecap="round" style="pointer-events:none"/><path class="pte-line" d="${d}" fill="none" stroke-width="${1.5 * u}"/>`;
  for (let i = 0; i < segs; i++) h += `<path class="seg" data-i="${i}" d="${dOf([P[i], P[(i + 1) % n]], false, 1, 1)}" fill="none" stroke-width="${14 * u}"/>`;
  const s = P[PTE.sel]; if (s) [['in', s.ix, s.iy], ['out', s.ox, s.oy]].forEach(([k, dx, dy]) => { if (dx || dy) h += `<line class="pte-hl" x1="${s.x}" y1="${s.y}" x2="${s.x + dx}" y2="${s.y + dy}" stroke-width="${u}"/><circle class="ph" data-i="${PTE.sel}" data-h="${k}" cx="${s.x + dx}" cy="${s.y + dy}" r="${4 * u}" stroke-width="${1.5 * u}"/>`; });
  P.forEach((p, i) => { h += `<rect class="pp${i === PTE.sel ? ' on' : ''}" data-i="${i}" x="${p.x - 4.5 * u}" y="${p.y - 4.5 * u}" width="${9 * u}" height="${9 * u}" stroke-width="${1.5 * u}"/>`; });
  ov.innerHTML = h;
}
function pteDown(e) { // true = gestito; false = clic fuori (esce dalla modifica e prosegue)
  if (!itemOf(PTE.id)) { pteKill(); return false; } const ov = document.getElementById('pte'), t = e.target.closest && e.target.closest('.pp,.ph,.seg');
  if (!t || !ov || !ov.contains(t)) { pteExit(); return false; }
  const P = PTE.pts, p0 = wpt(e), i = +t.dataset.i; let fn;
  if (t.classList.contains('pp')) { PTE.sel = i; const o = { x: P[i].x, y: P[i].y }; fn = (ev) => { const p = wpt(ev); P[i].x = o.x + p.x - p0.x; P[i].y = o.y + p.y - p0.y; }; }
  else if (t.classList.contains('ph')) { PTE.sel = i; const out = t.dataset.h === 'out'; fn = (ev) => { const p = wpt(ev), dx = p.x - P[i].x, dy = p.y - P[i].y; if (out) { P[i].ox = dx; P[i].oy = dy; if (!ev.altKey) { P[i].ix = -dx; P[i].iy = -dy; } } else { P[i].ix = dx; P[i].iy = dy; if (!ev.altKey) { P[i].ox = -dx; P[i].oy = -dy; } } }; }
  else { // lato: si sposta in perpendicolare (cambia larghezza/altezza di quel lato); con Maiusc è libero
    const a = P[i], b = P[(i + 1) % P.length], oa = { x: a.x, y: a.y }, ob = { x: b.x, y: b.y }, dx = ob.x - oa.x, dy = ob.y - oa.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    fn = (ev) => { const p = wpt(ev); let mx = p.x - p0.x, my = p.y - p0.y; if (!ev.shiftKey) { const s = mx * nx + my * ny; mx = s * nx; my = s * ny; } a.x = oa.x + mx; a.y = oa.y + my; b.x = ob.x + mx; b.y = ob.y + my; };
  }
  const st = stage(); try { st.setPointerCapture(e.pointerId); } catch {} let moved = false;
  const mv = (ev) => { if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return; moved = true; fn(ev); pteSync(); pteDraw(); };
  st.addEventListener('pointermove', mv); st.addEventListener('pointerup', () => { st.removeEventListener('pointermove', mv); if (moved) commit(); }, { once: true }); pteDraw(); return true;
}
function pteDbl(e) {
  const t = e.target.closest && e.target.closest('.pp,.seg'); if (!t) return; const P = PTE.pts, n = P.length, i = +t.dataset.i;
  if (t.classList.contains('pp')) { // punto: angolo <-> curva morbida
    const p = P[i]; if (p.ix || p.iy || p.ox || p.oy) p.ix = p.iy = p.ox = p.oy = 0;
    else { const a = !PTE.closed && i === 0 ? p : P[(i - 1 + n) % n], b = !PTE.closed && i === n - 1 ? p : P[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, len = Math.min(Math.hypot(p.x - a.x, p.y - a.y) || 1e9, Math.hypot(b.x - p.x, b.y - p.y) || 1e9) / 3; p.ox = dx / L * len; p.oy = dy / L * len; p.ix = -p.ox; p.iy = -p.oy; }
  } else { // lato: aggiunge un punto
    const a = P[i], b = P[(i + 1) % n], q = wpt(e), curved = a.ox || a.oy || b.ix || b.iy; let tt = 0, best = 1e18;
    if (!curved) { const dx = b.x - a.x, dy = b.y - a.y; tt = Math.min(.95, Math.max(.05, ((q.x - a.x) * dx + (q.y - a.y) * dy) / (dx * dx + dy * dy || 1))); }
    else for (let k = 1; k < 50; k++) { const s = splitSeg(a, b, k / 50).m, d = Math.hypot(s.x - q.x, s.y - q.y); if (d < best) { best = d; tt = k / 50; } }
    const sp = splitSeg(a, b, tt), np = curved ? { x: sp.m.x, y: sp.m.y, ix: sp.mIn[0], iy: sp.mIn[1], ox: sp.mOut[0], oy: sp.mOut[1] } : { x: sp.m.x, y: sp.m.y, ix: 0, iy: 0, ox: 0, oy: 0 };
    if (curved) { a.ox = sp.aOut[0]; a.oy = sp.aOut[1]; b.ix = sp.bIn[0]; b.iy = sp.bIn[1]; } P.splice(i + 1, 0, np); PTE.sel = i + 1;
  }
  pteSync(); pteDraw(); commit();
}
function pteDelete() {
  const P = PTE.pts, min = PTE.closed ? 3 : 2; if (P.length <= min) return toast(PTE.closed ? 'Una forma chiusa ha bisogno di almeno 3 punti' : 'Servono almeno 2 punti');
  P.splice(PTE.sel, 1); PTE.sel = Math.min(PTE.sel, P.length - 1); pteSync(); pteDraw(); commit();
}

/* ---- strumento penna ---- */
function penOverlay() { let ov = document.getElementById('pen'); if (!ov) { ov = document.createElementNS(SVGNS, 'svg'); ov.id = 'pen'; world().append(ov); } return ov; }
const markPen = () => { const b = $('#b-pen'); if (b) b.classList.toggle('on', PEN.on); };
function penOn() {
  if (view !== 'canvas' || PEN.on) return; if (PTE.on) pteExit(); select([]); closePop(); PEN.on = true; PEN.pts = []; PEN.cur = null; stage().classList.add('pen'); penOverlay(); markPen();
  toast('Penna: clic per un punto, trascina per curvare · clic sul primo punto per chiudere · Invio per finire · Esc annulla');
}
function penOff() { PEN.on = false; PEN.pts = []; PEN.cur = null; stage().classList.remove('pen'); const ov = document.getElementById('pen'); if (ov) ov.remove(); markPen(); }
const penToggle = () => (PEN.on ? penOff() : penOn());
const snap45 = (a, p) => { const ang = Math.round(Math.atan2(p.y - a.y, p.x - a.x) / (Math.PI / 4)) * Math.PI / 4, L = Math.hypot(p.x - a.x, p.y - a.y); return { x: a.x + Math.cos(ang) * L, y: a.y + Math.sin(ang) * L }; };
function penDraw() {
  if (!PEN.on) return; const ov = penOverlay(), u = 1 / vw().z, P = PEN.pts; let h = '';
  if (P.length) {
    const last = P[P.length - 1], near = PEN.cur && P.length >= 2 && Math.hypot(PEN.cur.x - P[0].x, PEN.cur.y - P[0].y) < 10 * u; let d = dOf(P, false, 1, 1);
    if (PEN.cur) { const g = near ? P[0] : PEN.cur; d += (last.ox || last.oy) ? `C${last.x + last.ox} ${last.y + last.oy} ${g.x} ${g.y} ${g.x} ${g.y}` : `L${g.x} ${g.y}`; }
    h += `<path class="pte-line" d="${d}" fill="none" stroke-width="${1.5 * u}"/>`;
    P.forEach((p) => [[p.ix, p.iy], [p.ox, p.oy]].forEach(([dx, dy]) => { if (dx || dy) h += `<line class="pte-hl" x1="${p.x}" y1="${p.y}" x2="${p.x + dx}" y2="${p.y + dy}" stroke-width="${u}"/><circle class="pph" cx="${p.x + dx}" cy="${p.y + dy}" r="${3.5 * u}"/>`; }));
    P.forEach((p, i) => { const s = (i === 0 && near ? 12 : 9) * u; h += `<rect class="pp${i === 0 && near ? ' on' : ''}" x="${p.x - s / 2}" y="${p.y - s / 2}" width="${s}" height="${s}" stroke-width="${1.5 * u}" style="pointer-events:none"/>`; });
  }
  ov.innerHTML = h;
}
function penDown(e) {
  const z = vw().z, P = PEN.pts, last = P[P.length - 1]; let p = wpt(e); if (e.shiftKey && last) p = snap45(last, p);
  if (P.length >= 2 && Math.hypot(p.x - P[0].x, p.y - P[0].y) < 10 / z) { penFinish(true); return; }
  if (last && Math.hypot(p.x - last.x, p.y - last.y) < 2 / z) return;
  const pt = { x: p.x, y: p.y, ix: 0, iy: 0, ox: 0, oy: 0 }; P.push(pt); const st = stage(); try { st.setPointerCapture(e.pointerId); } catch {}
  const mv = (ev) => { const q = wpt(ev), dx = q.x - pt.x, dy = q.y - pt.y; if (Math.hypot(dx, dy) * z < 4) return; pt.ox = dx; pt.oy = dy; pt.ix = -dx; pt.iy = -dy; penDraw(); };
  st.addEventListener('pointermove', mv); st.addEventListener('pointerup', () => { st.removeEventListener('pointermove', mv); penDraw(); }, { once: true }); penDraw();
}
function penFinish(closed) {
  const P = PEN.pts.map((p) => ({ ...p })); penOff(); if (P.length < 2) return; const cl = !!closed && P.length >= 3;
  const it = { id: uid(), kind: 'path', rot: 0, x: 0, y: 0, w: 1, h: 1, color: '#2A2A2C', stroke: '#E3E3E3', sw: 2, closed: cl, nofill: false, pts: [] }; fromWorld(it, P, cl); addItems([it]);
}
stage().addEventListener('pointermove', (e) => { if (!PEN.on) return; const last = PEN.pts[PEN.pts.length - 1], p = wpt(e); PEN.cur = e.shiftKey && last ? snap45(last, p) : p; penDraw(); });

/* ---- pannello proprietà: punti, riempimento/contorno, larghezza e altezza ---- */
function vecHtml(items) {
  const one = items.length === 1 ? items[0] : null; if (!one) return ''; const k = one.kind; let h = '';
  if (k === 'shape' || k === 'path') h += '<button class="pb1" id="v-edit">Modifica punti</button>';
  if (k === 'path') h += `<label class="pr"><span>Riempimento</span><input type="checkbox" id="v-fill" ${one.nofill ? '' : 'checked'}></label>
    <label class="pr"><span>Contorno</span><span class="cc"><input type="color" id="v-sc" value="${one.stroke || '#E3E3E3'}"><input type="range" id="v-sw" min="0" max="40" value="${one.sw || 0}"></span></label>
    <label class="pr"><span>Tracciato chiuso</span><input type="checkbox" id="v-closed" ${one.closed !== false ? 'checked' : ''}></label>`;
  if (['shape', 'path', 'color', 'frame', 'note', 'text', 'link'].includes(k)) h += `<div class="wh"><label>L<input type="number" id="v-w" min="1" value="${Math.round(one.w)}"></label><label>A<input type="number" id="v-h" min="1" value="${Math.round(one.h)}"></label><button class="mini" id="v-sq" title="Altezza uguale alla larghezza">Quadrato</button></div>`;
  return h;
}
function bindVec(p) {
  const one = selItems().length === 1 ? selItems()[0] : null; if (!one) return; const on = (id, fn, ev = 'oninput') => { const e = $(id, p); if (e) e[ev] = (x) => { fn(x.target); commitSoon(); }; };
  const setWH = (w, h) => { const cx = one.x + one.w / 2, cy = one.y + one.h / 2; one.w = Math.max(1, w); one.h = Math.max(1, h); one.x = cx - one.w / 2; one.y = cy - one.h / 2; refresh(one); updateBg(); commitSoon(); };
  on('#v-edit', () => pteEnter(one), 'onclick'); on('#v-fill', (t) => { one.nofill = !t.checked; refresh(one); }, 'onchange'); on('#v-sc', (t) => { one.stroke = t.value; refresh(one); }); on('#v-sw', (t) => { one.sw = +t.value; refresh(one); });
  on('#v-closed', (t) => { if (t.checked && (one.pts || []).length < 3) { t.checked = false; return; } one.closed = t.checked; refresh(one); }, 'onchange');
  on('#v-w', (t) => setWH(+t.value || 1, one.h), 'onchange'); on('#v-h', (t) => setWH(one.w, +t.value || 1), 'onchange'); on('#v-sq', () => { setWH(one.w, one.w); renderProps(); }, 'onclick');
}

/* ---- scorciatoie (cattura): P = penna; durante penna / modifica punti ---- */
document.addEventListener('keydown', (e) => {
  if (editing() || PRES.on) return; const ctrl = e.ctrlKey || e.metaKey; let used = true;
  if (PEN.on) { if (e.key === 'Enter') penFinish(false); else if (e.key === 'Escape') { PEN.pts.length >= 2 ? penFinish(false) : penOff(); } else if (e.key === 'Backspace' || e.key === 'Delete') { PEN.pts.pop(); penDraw(); } else if (e.code === 'KeyP' && !ctrl) penOff(); else used = false; }
  else if (PTE.on) { if (e.key === 'Delete' || e.key === 'Backspace') pteDelete(); else if (e.key === 'Enter' || e.key === 'Escape') pteExit(); else { if (ctrl && e.code === 'KeyZ') pteExit(); used = false; } }
  else if (view === 'canvas' && !ctrl && !e.altKey && !e.shiftKey && e.code === 'KeyP') penOn(); else used = false;
  if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
