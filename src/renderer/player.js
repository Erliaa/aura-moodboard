/* ===== Player musicale: file audio, YouTube, Spotify ===== */
const PL = { idx: -1, playing: false, vol: .8, loop: false, t: 0, dur: 0, cid: null };
const audioEl = new Audio(); audioEl.preload = 'metadata'; audioEl.crossOrigin = 'anonymous'; audioEl.volume = PL.vol;
const tracksOf = () => { const c = curCanvas(); return c ? (c.tracks || (c.tracks = [])) : []; };
const mPad = (n) => String(n).padStart(2, '0');
const fmtT = (s) => { if (!isFinite(s) || s < 0) return '--:--'; s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}:${mPad(m)}:${mPad(s % 60)}` : `${m}:${mPad(s % 60)}`; };
const fmtLeft = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`; };
const endsAt = (s) => new Date(Date.now() + s * 1000).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
let seeking = false;

function parseMusicLink(u) {
  let p; try { p = new URL(/^https?:\/\//i.test(u.trim()) ? u.trim() : 'https://' + u.trim()); } catch { return null; }
  const h = p.hostname.replace(/^www\./, '');
  if (h === 'youtu.be') { const id = p.pathname.slice(1, 12); return /^[\w-]{11}$/.test(id) ? { kind: 'yt', id, url: 'https://www.youtube.com/watch?v=' + id } : null; }
  if (/(^|\.)youtube\.com$/.test(h)) { const id = p.searchParams.get('v') || (/^\/(shorts|embed|live)\/([\w-]{11})/.exec(p.pathname) || [])[2]; return id && /^[\w-]{11}$/.test(id) ? { kind: 'yt', id, url: 'https://www.youtube.com/watch?v=' + id } : null; }
  if (h === 'open.spotify.com') { const m = /^\/(?:intl-[a-z]+\/)?(track|episode|album|playlist|show)\/([A-Za-z0-9]+)/.exec(p.pathname); return m ? { kind: 'sp', type: m[1], id: m[2], url: `https://open.spotify.com/${m[1]}/${m[2]}` } : null; }
  return null;
}

/* --- interfaccia --- */
const mahOf = () => PL.mah || (PL.mah = autoHide($('#mp'), { margin: 150, when: () => $('#mp').classList.contains('mini') && !$('#mp').classList.contains('hidden') }));
function toggleMinPlayer() { const mp = $('#mp'), mini = mp.classList.toggle('mini'); if (mini) mahOf().reveal(); else mp.classList.remove('vis'); }
function buildPlayer() {
  const mp = $('#mp'); if (!mp) return;
  mp.innerHTML = `<div class="mp-cover">${icon('music_note', 20)}</div><div class="mp-main">
    <div class="mp-title"></div><div class="mp-artist"></div>
    <div class="mp-bar"><i></i><b></b></div><div class="mp-times"><span class="mp-el">0:00</span><span class="mp-rem"></span></div></div>
    <div class="mp-ctl">
      <button id="mp-prev" title="Precedente">${icon('skip_previous', 20)}</button>
      <button id="mp-play" class="mp-playbtn" title="Play / Pausa">${icon('play_arrow', 22)}</button>
      <button id="mp-next" title="Successivo">${icon('skip_next', 20)}</button>
      <span class="mp-sep"></span>
      <button id="mp-rep" title="Ripeti tutto">${icon('repeat', 18)}</button>
      <span class="mp-vol"><button id="mp-mute" title="Volume">${icon('volume_up', 18)}</button><input type="range" id="mp-vol" min="0" max="100" value="${PL.vol * 100}"></span>
      <button id="mp-q" title="Brani">${icon('queue_music', 18)}</button>
      <button id="mp-min" title="Minimizza">${icon('expand_more', 18)}</button>
      <button id="mp-x" title="Chiudi">${icon('close', 18)}</button>
    </div>
    <div class="mp-mctl"><button id="mp-mprev" title="Precedente">${icon('skip_previous', 18)}</button><button id="mp-mplay" class="mp-playbtn" title="Play / Pausa">${icon('play_arrow', 18)}</button><button id="mp-mnext" title="Successivo">${icon('skip_next', 18)}</button></div>`;
  $('#mp-prev').onclick = prevTrack; $('#mp-next').onclick = () => nextTrack(false); $('#mp-play').onclick = togglePlay; $('#mp-x').onclick = closePlayer; $('#mp-q').onclick = () => musicPop();
  $('#mp-mprev').onclick = prevTrack; $('#mp-mnext').onclick = () => nextTrack(false); $('#mp-mplay').onclick = togglePlay;
  $('#mp-min').onclick = toggleMinPlayer; $('.mp-cover', mp).onclick = toggleMinPlayer;
  $('#mp-rep').onclick = () => { PL.loop = !PL.loop; $('#mp-rep').classList.toggle('on', PL.loop); };
  $('#mp-vol').oninput = (e) => setVol(e.target.value / 100);
  $('#mp-mute').onclick = () => { setVol(PL.vol > 0 ? 0 : .8); $('#mp-vol').value = PL.vol * 100; };
  const bar = $('.mp-bar', mp), tip = $('b', bar), fill = $('i', bar);
  bar.onpointermove = (e) => { if (!PL.dur) return; const r = bar.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); tip.textContent = fmtT(f * PL.dur); tip.style.left = f * 100 + '%'; };
  bar.onpointerdown = (e) => {
    if (!PL.dur) return; bar.setPointerCapture(e.pointerId); seeking = true; const r = bar.getBoundingClientRect(), at = (ev) => Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)); let f = at(e); fill.style.width = f * 100 + '%';
    const mv = (ev) => { f = at(ev); fill.style.width = f * 100 + '%'; $('.mp-el').textContent = fmtT(f * PL.dur); };
    bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', () => { bar.removeEventListener('pointermove', mv); seeking = false; seekTo(f * PL.dur); }, { once: true });
  };
}
function paintPlayer() {
  const mp = $('#mp'), t = tracksOf()[PL.idx]; if (!mp) return;
  if (!t || PL.cid !== openId) { mp.classList.add('hidden'); PL._sig = null; $('#canvas').classList.remove('mp-on'); return; }
  mp.classList.remove('hidden'); $('#canvas').classList.add('mp-on'); { const sig = PL.idx + ':' + PL.cid + ':' + PL.playing; if (mp.classList.contains('mini') && PL._sig !== sig) mahOf().reveal(); PL._sig = sig; } // minimizzato: si mostra quando parte/cambia la musica mp.classList.toggle('sp-mode', t.kind === 'sp'); mp.classList.toggle('playing', PL.playing);
  $('.mp-title', mp).textContent = t.title || t.name || ''; $('.mp-artist', mp).textContent = t.artist || '';
  const cv = t.cover ? fileUrl(t.cover) : ''; $('.mp-cover', mp).innerHTML = cv ? `<img src="${cv}">` : icon('music_note', 20);
  $('#mp-play').innerHTML = icon(PL.playing ? 'pause' : 'play_arrow', 22); $('#mp-mplay').innerHTML = icon(PL.playing ? 'pause' : 'play_arrow', 18); $('#mp-mute').innerHTML = icon(PL.vol > 0 ? 'volume_up' : 'volume_off', 18); markQueue();
}
function paintTime() {
  if (!$('#mp') || $('#mp').classList.contains('hidden')) return; const d = PL.dur, t = PL.t, rem = d ? d - t : NaN;
  if (!seeking) { $('.mp-el').textContent = fmtT(t); $('.mp-bar i').style.width = d ? Math.min(100, t / d * 100) + '%' : '0%'; }
  $('.mp-rem').textContent = d ? `${fmtLeft(rem)} rimanenti · finisce alle ${endsAt(rem)}` : '';
}

/* --- motori di riproduzione --- */
const YT = { f: null, timer: null, got: false };
function ytCmd(func, args = []) { try { YT.f && YT.f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com'); } catch {} }
function ytStop() { clearInterval(YT.timer); YT.timer = null; if (YT.f) { YT.f.remove(); YT.f = null; } YT.got = false; }
function ytLoad(t, auto) {
  const f = document.createElement('iframe'); f.className = 'ytf'; f.allow = 'autoplay; encrypted-media';
  f.src = `https://www.youtube.com/embed/${t.vid}?enablejsapi=1&autoplay=${auto ? 1 : 0}&controls=0&rel=0&playsinline=1`; document.body.append(f); YT.f = f; YT.got = false; const t0 = Date.now();
  const hello = () => { try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), 'https://www.youtube.com'); } catch {} };
  f.onload = hello; YT.timer = setInterval(() => { if (!YT.f) return; if (!YT.got) { hello(); if (Date.now() - t0 > 9000) { clearInterval(YT.timer); toast('YouTube non risponde: controlla la connessione o prova un altro link'); } } }, 400);
}
function ytState(s) { if (s === 1) PL.playing = true; else if (s === 2 || s === 5) PL.playing = false; else if (s === 0) { PL.playing = false; nextTrack(true); return; } paintPlayer(); }
addEventListener('message', (e) => {
  if (e.origin !== 'https://www.youtube.com' || !YT.f || e.source !== YT.f.contentWindow) return; let d; try { d = JSON.parse(e.data); } catch { return; }
  if (d.event === 'onError') { toast('Questo video non può essere riprodotto qui'); return; }
  if (typeof d.info === 'number') { if (d.event === 'onStateChange') ytState(d.info); return; }
  const i = d.info; if (!i || typeof i !== 'object') return;
  if (!YT.got) { YT.got = true; ytCmd('setVolume', [PL.vol * 100]); }
  if (typeof i.currentTime === 'number') PL.t = i.currentTime; if (i.duration > 0) PL.dur = i.duration; if (typeof i.playerState === 'number') ytState(i.playerState); paintTime();
});
function spLoad(t) {
  $('.mp-sp').innerHTML = `<iframe src="https://open.spotify.com/embed/${t.type}/${t.vid}?utm_source=generator&theme=0" width="100%" height="${t.type === 'track' || t.type === 'episode' ? 80 : 152}" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;
}
audioEl.ontimeupdate = () => { PL.t = audioEl.currentTime; if (isFinite(audioEl.duration) && audioEl.duration > 0) PL.dur = audioEl.duration; paintTime(); };
audioEl.onloadedmetadata = () => { if (isFinite(audioEl.duration)) { PL.dur = audioEl.duration; const t = tracksOf()[PL.idx]; if (t && t.kind === 'file' && Math.abs((t.dur || 0) - PL.dur) > 1) { t.dur = PL.dur; save(); markQueue(); } } paintTime(); };
audioEl.onplay = () => { PL.playing = true; paintPlayer(); }; audioEl.onpause = () => { PL.playing = false; paintPlayer(); };
audioEl.onended = () => nextTrack(true);
audioEl.onerror = () => { if (audioEl.getAttribute('src')) toast('Impossibile riprodurre questo file'); };

function stopEngines() {
  try { audioEl.pause(); } catch {} if (audioEl.getAttribute('src')) { audioEl.removeAttribute('src'); try { audioEl.load(); } catch {} }
  ytStop(); const sp = $('.mp-sp'); if (sp) sp.innerHTML = ''; PL.playing = false; PL.t = 0; PL.dur = 0;
}
function playIdx(i, auto = true) {
  const tr = tracksOf(), t = tr[i]; if (!t) return; stopEngines(); PL.idx = i; PL.cid = openId;
  if (t.kind === 'file') { audioEl.src = fileUrl(t.file); PL.dur = t.dur || 0; if (auto) audioEl.play().catch(() => {}); }
  else if (t.kind === 'yt') ytLoad(t, auto); else spLoad(t);
  paintPlayer(); paintTime();
}
function togglePlay() { const t = tracksOf()[PL.idx]; if (!t) return; if (t.kind === 'file') { audioEl.paused ? audioEl.play().catch(() => {}) : audioEl.pause(); } else if (t.kind === 'yt') ytCmd(PL.playing ? 'pauseVideo' : 'playVideo'); }
function seekTo(s) { const t = tracksOf()[PL.idx]; if (!t) return; if (t.kind === 'file') audioEl.currentTime = s; else if (t.kind === 'yt') ytCmd('seekTo', [s, true]); PL.t = s; paintTime(); }
function setVol(v) { PL.vol = v; audioEl.volume = v; ytCmd('setVolume', [v * 100]); const m = $('#mp-mute'); if (m) m.innerHTML = icon(v > 0 ? 'volume_up' : 'volume_off', 20); }
function nextTrack(auto) {
  const tr = tracksOf(), n = tr.length; if (!n) return; const ok = (i) => !PL.onlyFiles || tr[i].kind === 'file';
  let i = PL.idx + 1; while (i < n && !ok(i)) i++;
  if (i < n) playIdx(i); else if (PL.loop && !PL.onlyFiles) playIdx(0); else if (PL.onlyFiles) { PL.onlyFiles = false; stopEngines(); } else if (auto) playIdx(0, false);
}
function prevTrack() { if (PL.t > 3) return seekTo(0); const n = tracksOf().length; if (PL.idx > 0) playIdx(PL.idx - 1); else if (PL.loop && n) playIdx(n - 1); else seekTo(0); }
function closePlayer() { stopEngines(); PL.idx = -1; PL.cid = null; paintPlayer(); }
function playerSync() { if (PL.cid && PL.cid !== openId || view !== 'canvas') { if (PL.idx >= 0) { stopEngines(); PL.idx = -1; PL.cid = null; } } paintPlayer(); }

/* --- aggiunta e rimozione brani --- */
const fileRefs = (f, except) => S.canvases.reduce((n, c) => n + (c === except ? 0 : (c.tracks || []).filter((t) => t.file === f || t.cover === f).length), 0);
function releaseFiles(t, except) { [t.file, t.cover].filter(Boolean).forEach((f) => { if (!fileRefs(f, except)) aura.del(f); }); }
function releaseTracks(c) { (c.tracks || []).forEach((t) => releaseFiles(t, c)); }
function probeDur(t) { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => { if (isFinite(a.duration)) { t.dur = a.duration; save(); markQueue(); } a.removeAttribute('src'); }; a.src = fileUrl(t.file); }
function addEntries(en) {
  if (!en || !en.length) return; const tr = tracksOf(), first = tr.length;
  en.forEach((e) => { const t = { id: uid(), kind: 'file', file: e.file, name: e.name, title: e.title, artist: e.artist, cover: e.cover, dur: 0 }; tr.push(t); probeDur(t); });
  save(); if (PL.idx < 0 || PL.cid !== openId) playIdx(first, false); toast(en.length === 1 ? 'Brano aggiunto' : en.length + ' brani aggiunti'); refreshMusicPop();
}
async function pickAudioFiles() { const en = await aura.pickAudio(); if (en.length) toast('Importo i brani…'); addEntries(en); }
async function playerAddFiles(files) {
  const paths = []; for (const f of files) { let p = ''; try { p = aura.pathOf(f); } catch {} if (p) paths.push(p); }
  if (!paths.length) return toast('Trascina i file audio direttamente da Esplora risorse'); toast('Importo ' + paths.length + (paths.length === 1 ? ' brano…' : ' brani…')); addEntries(await aura.importAudio(paths));
}
async function addMusicLink(u) {
  const pl = parseMusicLink(u); if (!pl) return toast('Link non riconosciuto: usa un link di YouTube o Spotify');
  toast('Recupero le informazioni…'); const m = await aura.linkMeta(pl.url).catch(() => null);
  const tr = tracksOf(), t = { id: uid(), kind: pl.kind, vid: pl.id, type: pl.type, url: pl.url, title: (m && m.title) || pl.url, artist: (m && m.author) || (pl.kind === 'yt' ? 'YouTube' : 'Spotify'), cover: (m && m.cover) || null, dur: 0 };
  tr.push(t); save(); if (PL.idx < 0 || PL.cid !== openId) playIdx(tr.length - 1, false); toast('Aggiunto'); refreshMusicPop();
}
function removeTrack(i) {
  const tr = tracksOf(), t = tr[i]; if (!t) return;
  if (i === PL.idx) { stopEngines(); PL.idx = -1; } else if (i < PL.idx) PL.idx--;
  tr.splice(i, 1); releaseFiles(t); save(); paintPlayer(); refreshMusicPop();
}
function markQueue() { document.querySelectorAll('#pop .mt').forEach((r) => r.classList.toggle('on', +r.dataset.i === PL.idx && PL.cid === openId)); }
function refreshMusicPop() { if (popKind === 'music') { popKind = null; musicPop(); } }
function musicPop() {
  const tr = tracksOf();
  const row = (t, i) => `<div class="mt ${i === PL.idx && PL.cid === openId ? 'on' : ''}" data-i="${i}"><span class="th2">${t.cover ? `<img src="${fileUrl(t.cover)}">` : icon('music_note', 20)}</span><span><b>${esc(t.title || t.name || '')}</b><small>${esc(t.artist || '')}${t.artist && t.dur ? ' · ' : ''}${t.dur ? fmtT(t.dur) : ''}${t.kind === 'file' ? '' : (t.artist ? ' · ' : '') + (t.kind === 'yt' ? 'YouTube' : 'Spotify')}</small></span><button class="mx" data-i="${i}" title="Rimuovi">${icon('close', 16)}</button></div>`;
  const p = showPop(`<div class="mq">${tr.length ? tr.map(row).join('') : '<p class="hint">Nessun brano in questo canvas.</p>'}</div>
    <button class="wide" id="m-add">${icon('music_note', 18)}Carica brani…</button>
    <div class="row" style="margin-top:8px"><input type="text" id="m-url" placeholder="Link YouTube o Spotify"><button id="m-go" class="go">Aggiungi</button></div>
    <small class="hint">Formati: MP3, WAV, FLAC, M4A, AAC, OGG, OPUS. Puoi anche trascinare i file sul canvas.</small>`, 'music'); if (!p) return;
  p.querySelectorAll('.mt').forEach((r) => r.onclick = (e) => { if (e.target.closest('.mx')) return; playIdx(+r.dataset.i); });
  p.querySelectorAll('.mx').forEach((b) => b.onclick = (e) => { e.stopPropagation(); removeTrack(+b.dataset.i); });
  $('#m-add').onclick = () => pickAudioFiles();
  const go = () => { const v = $('#m-url').value; if (v.trim()) addMusicLink(v); }; $('#m-go').onclick = go; $('#m-url').onkeydown = (e) => { if (e.key === 'Enter') go(); e.stopPropagation(); };
}
buildPlayer();

/* Musica nell'export video: i brani "file" del canvas suonano in sequenza e finiscono nella traccia audio */
let AC = null;
async function startAudioCapture(stream) {
  const first = tracksOf().findIndex((t) => t.kind === 'file'); if (first < 0) { toast('Nessun brano da file: il video sarà senza audio'); return null; }
  try {
    if (!AC) { const ctx = new AudioContext(), src = ctx.createMediaElementSource(audioEl), dest = ctx.createMediaStreamDestination(); src.connect(ctx.destination); src.connect(dest); AC = { ctx, dest }; }
    await AC.ctx.resume(); AC.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    PL.onlyFiles = true; playIdx(first, true);
    return () => { PL.onlyFiles = false; stopEngines(); };
  } catch { toast('Audio non disponibile: il video sarà senza musica'); return null; }
}
