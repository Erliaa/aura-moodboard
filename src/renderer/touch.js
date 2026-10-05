/* ===== Touch: due dita = sposta e zoomma il canvas, doppio tocco = doppio clic ===== */
const TCH = { pts: new Map(), down: new Map(), dead: new Set(), pinch: null, tap: { t: 0, x: 0, y: 0 }, nativeDbl: 0 };
function startPinch() {
  const ids = [...TCH.pts.keys()], a = TCH.pts.get(ids[0]), b = TCH.pts.get(ids[1]), r = stage().getBoundingClientRect(), v = vw(); ids.forEach((i) => TCH.dead.add(i));
  TCH.pinch = { ids, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx0: (a.x + b.x) / 2 - r.left, my0: (a.y + b.y) / 2 - r.top, v0: { x: v.x, y: v.y, z: v.z } };
}
function updatePinch() {
  const p = TCH.pinch; if (!p) return; const a = TCH.pts.get(p.ids[0]), b = TCH.pts.get(p.ids[1]); if (!a || !b) return;
  const r = stage().getBoundingClientRect(), v = vw(), z = Math.min(4, Math.max(.1, p.v0.z * Math.hypot(a.x - b.x, a.y - b.y) / p.d0)), mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
  const wx = (p.mx0 - p.v0.x) / p.v0.z, wy = (p.my0 - p.v0.y) / p.v0.z; v.z = z; v.x = mx - wx * z; v.y = my - wy * z; applyView(); save(); // il punto sotto le dita resta sotto le dita
}
(() => {
  const st = stage(); if (!st) return;
  st.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return; TCH.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); TCH.down.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp });
    if (TCH.pts.size === 2) { startPinch(); e.stopImmediatePropagation(); e.preventDefault(); } else if (TCH.pts.size > 2) e.stopImmediatePropagation();
  }, true);
  st.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') return; if (TCH.pts.has(e.pointerId)) TCH.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (TCH.dead.has(e.pointerId)) { if (TCH.pinch) updatePinch(); e.stopImmediatePropagation(); } // il gesto a un dito iniziato prima del pizzico non deve più muovere nulla
  }, true);
  const up = (e) => {
    if (e.pointerType !== 'touch') return; const d = TCH.down.get(e.pointerId), dead = TCH.dead.has(e.pointerId);
    TCH.pts.delete(e.pointerId); TCH.down.delete(e.pointerId); TCH.dead.delete(e.pointerId); if (TCH.pinch && TCH.pinch.ids.includes(e.pointerId)) TCH.pinch = null;
    if (e.type !== 'pointerup' || dead || !d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || e.timeStamp - d.t > 500) { TCH.tap.t = 0; return; }
    const T = TCH.tap;
    if (T.t && e.timeStamp - T.t < 400 && Math.hypot(e.clientX - T.x, e.clientY - T.y) < 30) { // doppio tocco -> doppio clic (se il browser non l'ha già generato)
      TCH.tap.t = 0; const tg = (document.elementFromPoint && document.elementFromPoint(e.clientX, e.clientY)) || e.target, before = TCH.nativeDbl;
      setTimeout(() => { if (TCH.nativeDbl === before) tg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY })); }, 120);
    } else TCH.tap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
  };
  st.addEventListener('pointerup', up, true); st.addEventListener('pointercancel', up, true);
  document.addEventListener('dblclick', () => { TCH.nativeDbl++; }, true);
})();
