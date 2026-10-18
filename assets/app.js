/* Explorer — systemübergreifender Datei-Explorer (PWA). Kein Framework, eine Datei. */
(function () {
  'use strict';

  // ---------- Umgebung ----------
  const UA = navigator.userAgent;
  const IS_IOS = /iPhone|iPad|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const IS_WIN = /Windows/.test(UA);
  const STANDALONE = (matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const $app = document.getElementById('app');

  // ---------- Persistenz (nur Komfort) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('explorer.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('explorer.' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('explorer.' + k); } catch (e) {} }
  };

  // ---------- Zustand ----------
  const S = {
    index: null, items: [], byId: new Map(), children: new Map(), sources: [],
    tab: store.get('tab', 'browse'),
    stacks: { recent: [], browse: [], changes: [] },
    view: store.get('view', 'list'), sort: store.get('sort', 'name'), dir: store.get('dir', 'asc'),
    favs: new Set(store.get('favs', [])),
    opened: store.get('opened', []),
    menu: null, sheet: null
  };

  // ---------- Icons (SF-nah, inline) ----------
  const I = {
    chevron: '<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M1 1l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    back: '<svg width="12" height="20" viewBox="0 0 12 20" fill="none"><path d="M10 2L2 10l8 8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#8e8e93" stroke-width="1.8"><circle cx="6.8" cy="6.8" r="5"/><path d="M10.5 10.5L14 14" stroke-linecap="round"/></svg>',
    x: '<svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>',
    info: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="9.25" stroke="currentColor" stroke-width="1.5"/><path d="M11 10v5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="11" cy="7" r="1.1" fill="currentColor"/></svg>',
    more: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9.25" stroke="currentColor" stroke-width="1.5"/><circle cx="7.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="16.5" cy="12" r="1.3" fill="currentColor"/></svg>',
    check: '<svg width="16" height="14" viewBox="0 0 16 14" fill="none"><path d="M1.5 7.5l4 4L14.5 2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    star: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>',
    starF: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7l-5.9 3.1 1.2-6.5L2.5 9.7l6.6-.9z"/></svg>',
    tabRecent: '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="13" cy="13" r="9.5"/><path d="M13 7.5V13l3.8 2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    tabBrowse: '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M3.5 8.5a2 2 0 0 1 2-2h5l2.2 2.3h7.8a2 2 0 0 1 2 2v8.7a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z"/></svg>',
    tabChanges: '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 9.5A8 8 0 0 0 6 7.6M5.5 16.5A8 8 0 0 0 20 18.4"/><path d="M20.5 4.5v5h-5M5.5 21.5v-5h5"/></svg>',
    drive: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M8.5 3h7l6 10.5-3.5 6H6L2.5 13.5zM9.3 5l-5 8.5h4.6L13.9 5zM12 14.5h4.7l-2.3 3.9H6.6z" opacity=".95"/></svg>',
    icloud: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M7 18.5a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9.3 3.9 3.9 0 0 1 18 18.5z"/></svg>',
    notes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M6 7h12M6 12h12M6 17h8"/></svg>',
    reminders: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="7" cy="7" r="2"/><circle cx="7" cy="17" r="2"/><path d="M12 7h7M12 17h7"/></svg>',
    clock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.3 2" stroke-linecap="round"/></svg>',
    gear: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    face: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M9 9.5v1M15 9.5v1M12 9.5v4h-1M9 15.2a4.5 4.5 0 0 0 6 0"/></svg>',
    link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>'
  };
  const folderSVG = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64"><defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd0ff"/><stop offset="1" stop-color="#2f9ff3"/></linearGradient><linearGradient id="fb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fb8f7"/><stop offset="1" stop-color="#2385dd"/></linearGradient></defs><path d="M6 18a4 4 0 0 1 4-4h14l5 5h25a4 4 0 0 1 4 4v27a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="url(#fb)"/><path d="M6 26a3 3 0 0 1 3-3h46a3 3 0 0 1 3 3v24a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="url(#fg)"/></svg>`;
  // Dokument-Icon mit Eselsohr + Badge
  const docSVG = (s, color, label, fold = true) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64"><path d="M16 6h22l12 12v38a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" fill="#fff" stroke="rgba(0,0,0,.18)" stroke-width="1"/><path d="M38 6v9a3 3 0 0 0 3 3h9" fill="#e5e5ea" stroke="rgba(0,0,0,.18)" stroke-width="1"/><rect x="10" y="38" width="36" height="15" rx="3" fill="${color}"/><text x="28" y="49" text-anchor="middle" font-family="-apple-system,Segoe UI,sans-serif" font-size="9.5" font-weight="700" fill="#fff" letter-spacing=".5">${label}</text></svg>`;
  const noteSVG = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64"><rect x="10" y="8" width="44" height="50" rx="6" fill="#fff" stroke="rgba(0,0,0,.14)"/><rect x="10" y="8" width="44" height="13" rx="6" fill="#ffd60a"/><rect x="10" y="16" width="44" height="5" fill="#ffd60a"/><path d="M18 30h28M18 38h28M18 46h18" stroke="#c7c7cc" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  const reminderSVG = (s, done) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64"><rect x="8" y="12" width="48" height="40" rx="8" fill="#fff" stroke="rgba(0,0,0,.14)"/><circle cx="21" cy="26" r="5.5" fill="${done ? '#ff3b30' : 'none'}" stroke="#ff3b30" stroke-width="2.2"/><circle cx="21" cy="40" r="5.5" fill="none" stroke="#ff9f0a" stroke-width="2.2"/><path d="M31 26h17M31 40h12" stroke="#c7c7cc" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  const imageSVG = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 64 64"><rect x="8" y="12" width="48" height="40" rx="5" fill="#dfe7f3" stroke="rgba(0,0,0,.14)"/><circle cx="23" cy="26" r="5" fill="#ffd60a"/><path d="M8 46l15-13 11 9 8-6 14 10v6a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5z" fill="#34c759"/></svg>`;
  const TYPE = {
    gdoc: { label: 'Google Doc', ico: s => docSVG(s, '#4285f4', 'DOC') },
    docx: { label: 'Word', ico: s => docSVG(s, '#2b579a', 'DOCX') },
    pdf: { label: 'PDF', ico: s => docSVG(s, '#ff3b30', 'PDF') },
    md: { label: 'Markdown', ico: s => docSVG(s, '#636366', 'MD') },
    txt: { label: 'Text', ico: s => docSVG(s, '#8e8e93', 'TXT') },
    sheet: { label: 'Tabelle', ico: s => docSVG(s, '#34a853', 'XLS') },
    slides: { label: 'Präsentation', ico: s => docSVG(s, '#fbbc04', 'PPT') },
    image: { label: 'Bild', ico: s => imageSVG(s) },
    note: { label: 'Notiz', ico: s => noteSVG(s) },
    reminder: { label: 'Erinnerung', ico: (s, it) => reminderSVG(s, it && it.done) },
    other: { label: 'Datei', ico: s => docSVG(s, '#8e8e93', '') }
  };
  const TAGS = [
    { id: 'docs', name: 'Dokumente', color: '#4285f4', types: ['gdoc', 'docx', 'md', 'txt'] },
    { id: 'pdf', name: 'PDFs', color: '#ff3b30', types: ['pdf'] },
    { id: 'img', name: 'Bilder', color: '#34c759', types: ['image'] },
    { id: 'tab', name: 'Tabellen & Folien', color: '#fbbc04', types: ['sheet', 'slides'] },
    { id: 'note', name: 'Notizen', color: '#ffd60a', types: ['note'] },
    { id: 'rem', name: 'Erinnerungen', color: '#ff9f0a', types: ['reminder'] }
  ];
  const SOURCE_NAME = { drive: 'Google Drive', icloud: 'iCloud Drive', notes: 'Notizen', reminders: 'Erinnerungen' };

  // ---------- Hilfen ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtSize = n => n == null ? '' : n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : n < 1073741824 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : (n / 1073741824).toFixed(2).replace('.', ',') + ' GB';
  const fmtDate = (iso, long) => {
    if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return '';
    const now = new Date(), t = new Date(now.getFullYear(), now.getMonth(), now.getDate()), dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((t - dd) / 864e5), hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (long) return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + hm;
    if (diff === 0) return 'Heute, ' + hm; if (diff === 1) return 'Gestern, ' + hm;
    if (diff < 7) return d.toLocaleDateString('de-DE', { weekday: 'long' }) + ', ' + hm;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  };
  const dayKey = iso => { const d = new Date(iso), n = new Date(); const diff = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); return diff === 0 ? 'Heute' : diff === 1 ? 'Gestern' : diff < 7 ? 'Diese Woche' : diff < 31 ? 'Dieser Monat' : d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }); };
  const plural = (n, s, p) => n + ' ' + (n === 1 ? s : p);
  const typeOf = it => TYPE[it.type] || TYPE.other;
  const iconOf = (it, s) => it.kind === 'folder' ? folderSVG(s) : (it.thumb ? `<img class="thumb" src="${it.thumb}" alt="">` : typeOf(it).ico(s, it));
  const kidsOf = (src, pid) => S.children.get(src + '/' + (pid || '')) || [];
  const descendants = (it) => { let out = []; (function walk(src, pid) { for (const k of kidsOf(src, pid)) { out.push(k); if (k.kind === 'folder') walk(src, k.id); } })(it.source, it.id); return out; };
  const countIn = it => kidsOf(it.source, it.id).length;
  const pathOf = it => { const p = []; let cur = it.parent ? S.byId.get(it.parent) : null; while (cur) { p.unshift(cur.name); cur = cur.parent ? S.byId.get(cur.parent) : null; } p.unshift(SOURCE_NAME[it.source] || it.source); return p; };
  const sortItems = (arr) => {
    const dir = S.dir === 'asc' ? 1 : -1, col = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
    return arr.slice().sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      let r = 0;
      if (S.sort === 'date') r = new Date(a.modified || 0) - new Date(b.modified || 0);
      else if (S.sort === 'size') r = (a.size || 0) - (b.size || 0);
      else if (S.sort === 'type') r = col.compare(typeOf(a).label, typeOf(b).label);
      if (r === 0) r = col.compare(a.name, b.name);
      return r * dir;
    });
  };
  const ageText = iso => { const h = (Date.now() - new Date(iso)) / 36e5; return h < 1 ? 'vor ' + Math.max(1, Math.round(h * 60)) + ' Min.' : h < 48 ? 'vor ' + Math.round(h) + ' Std.' : 'vor ' + Math.round(h / 24) + ' Tagen'; };

  // ---------- Öffnen (Deep-Link je Plattform) ----------
  function openTarget(it) {
    const src = it.source;
    if (src === 'drive') return { url: it.url, label: 'In Google Drive öffnen', ext: true };
    if (IS_IOS) {
      if (src === 'notes') return { url: it.open && it.open.ios || 'shortcuts://run-shortcut?name=' + encodeURIComponent('Notiz öffnen') + '&input=text&text=' + encodeURIComponent(it.name), label: 'In Notizen öffnen' };
      if (src === 'reminders') return { url: it.open && it.open.ios || 'x-apple-reminderkit://', label: 'In Erinnerungen öffnen' };
      if (src === 'icloud') return { url: it.open && it.open.ios || 'shareddocuments:///', label: 'In Dateien öffnen' };
    }
    if (src === 'notes') return { url: 'https://www.icloud.com/notes/', label: 'iCloud Notizen öffnen', ext: true, hint: 'Am Desktop öffnet iCloud.com; dort nach dem Titel suchen.' };
    if (src === 'reminders') return { url: 'https://www.icloud.com/reminders/', label: 'iCloud Erinnerungen öffnen', ext: true, hint: 'Am Desktop öffnet iCloud.com; dort die Liste wählen.' };
    if (src === 'icloud') return { url: 'https://www.icloud.com/iclouddrive/', label: 'iCloud Drive öffnen', ext: true, hint: 'Am Desktop öffnet iCloud.com.' };
    return { url: it.url, label: 'Öffnen', ext: true };
  }
  function altOpens(it) {
    const out = [];
    if (it.source === 'drive' && IS_IOS) out.push({ url: 'googledrive://file/' + it.id, label: 'Drive-App' });
    if (it.source === 'drive' && !IS_IOS) out.push({ url: 'https://drive.google.com/open?id=' + it.id, label: 'Im Drive-Ordner', ext: true });
    return out;
  }
  function openItem(it) {
    const t = openTarget(it);
    S.opened = [it.id].concat(S.opened.filter(x => x !== it.id)).slice(0, 30); store.set('opened', S.opened);
    if (it.sample) { toast('Beispiel-Eintrag – echte Daten kommen mit dem Sync'); return; }
    if (t.ext) { const a = document.createElement('a'); a.href = t.url; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
    else { location.href = t.url; }
  }

  // ---------- Daten laden / entschlüsseln ----------
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function decrypt(enc, pass) {
    const te = new TextEncoder();
    const km = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(enc.salt), iterations: enc.iterations, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(enc.iv) }, key, b64(enc.data));
    return JSON.parse(new TextDecoder().decode(buf));
  }
  function ingest(idx) {
    S.index = idx; S.items = idx.items || []; S.sources = idx.sources || []; S.byId = new Map(); S.children = new Map();
    for (const it of S.items) { S.byId.set(it.id, it); const k = it.source + '/' + (it.parent || ''); if (!S.children.has(k)) S.children.set(k, []); S.children.get(k).push(it); }
  }

  // ---------- Sperrbildschirm ----------
  function renderLock(msg) {
    $app.innerHTML = `<div class="lock">
      <div class="icon">${folderSVG(44)}</div>
      <h1>Explorer</h1>
      <p>Der Index ist verschlüsselt. Passphrase eingeben, um deine Dateien zu sehen.</p>
      <input id="pass" type="password" placeholder="Passphrase" autocomplete="current-password" enterkeyhint="go" ${STANDALONE ? 'autofocus' : ''}>
      <button class="btn" id="unlock">Entsperren</button>
      <div class="status" id="lstatus">${esc(msg || '')}</div>
    </div>`;
    const inp = document.getElementById('pass'), st = document.getElementById('lstatus');
    const go = async () => { st.textContent = 'Entschlüssele …'; try { await boot(inp.value, true); } catch (e) { inp.classList.remove('err'); void inp.offsetWidth; inp.classList.add('err'); st.textContent = e && e.message === 'fetch' ? 'Index nicht erreichbar – Netz prüfen.' : 'Passphrase passt nicht.'; } };
    document.getElementById('unlock').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
  }
  async function loadEnc() {
    let r; try { r = await fetch('index.enc.json', { cache: 'no-cache' }); } catch (e) { r = null; }
    if (!r || !r.ok) { const c = await caches.match('index.enc.json').catch(() => null); if (!c) throw new Error('fetch'); r = c; }
    return r.json();
  }
  async function boot(pass, remember) {
    const enc = await loadEnc();
    const idx = await decrypt(enc, pass);
    if (remember) store.set('pass', pass);
    ingest(idx); renderApp();
    if (remember && !store.get('bio', null) && !store.get('bioAsked', false)) { store.set('bioAsked', true); if (await bioAvailable()) setTimeout(() => offerBio(), 600); }
  }

  // ---------- App-Gerüst ----------
  function renderApp() {
    $app.innerHTML = `<nav class="sidebar" id="sidebar"></nav><div class="stack" id="stack"></div>
      <div class="tabwrap" id="tabwrap"><div class="tabbar" id="tabbar">
        <button class="tab" data-tab="recent">${I.tabRecent}<span>Zuletzt</span></button>
        <button class="tab" data-tab="browse">${I.tabBrowse}<span>Durchsuchen</span></button>
        <button class="tab" data-tab="changes">${I.tabChanges}<span>Änderungen</span></button>
      </div><button class="searchfab" id="searchfab" aria-label="Suchen">${I.search.replace('stroke="#8e8e93"', 'stroke="currentColor"').replace('width="16" height="16"', 'width="20" height="20"')}</button></div>`;
    document.getElementById('searchfab').addEventListener('click', () => { const t = topEl(); const inp = t && t.querySelector('.search input'); if (inp) { t.querySelector('.content').scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => inp.focus(), 250); } });
    document.getElementById('tabbar').addEventListener('click', e => { const b = e.target.closest('.tab'); if (!b) return; const t = b.dataset.tab; if (t === S.tab) { popToRoot(); const c = topEl() && topEl().querySelector('.content'); if (c) c.scrollTo({ top: 0, behavior: 'smooth' }); } else switchTab(t); });
    for (const t of ['recent', 'browse', 'changes']) if (!S.stacks[t].length) S.stacks[t].push({ type: t === 'browse' ? 'root' : t });
    if (matchMedia('(min-width:900px)').matches && !['recent','browse','changes'].includes(S.tab)) S.tab = 'browse';
    mountStack();
    // Service Worker
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const stackEl = () => document.getElementById('stack');
  const topEl = () => stackEl() && stackEl().lastElementChild;
  function switchTab(t) { S.tab = t; store.set('tab', t); mountStack(); }
  function mountStack() {
    const st = stackEl(); st.innerHTML = '';
    const stack = S.stacks[S.tab];
    stack.forEach((sc, i) => { const el = buildScreen(sc); if (i < stack.length - 1) el.classList.add('under'); st.appendChild(el); });
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === S.tab));
    renderSidebar();
  }
  function push(sc) {
    const stack = S.stacks[S.tab]; stack.push(sc);
    const prev = topEl(); const el = buildScreen(sc); el.classList.add('enter'); stackEl().appendChild(el);
    if (prev) { prev.classList.add('under-enter'); prev.addEventListener('animationend', () => { prev.classList.remove('under-enter'); prev.classList.add('under'); }, { once: true }); }
    el.addEventListener('animationend', () => el.classList.remove('enter'), { once: true });
    closeMenu(); renderSidebar();
  }
  function pop() {
    const stack = S.stacks[S.tab]; if (stack.length < 2) return; stack.pop();
    const top = topEl(), prev = top.previousElementSibling;
    top.classList.add('leave'); top.addEventListener('animationend', () => top.remove(), { once: true });
    if (prev) { prev.classList.remove('under'); prev.classList.add('under-leave'); prev.addEventListener('animationend', () => prev.classList.remove('under-leave'), { once: true }); }
    if (matchMedia('(min-width:900px)').matches) { top.remove(); if (prev) { prev.classList.remove('under', 'under-leave'); } }
    closeMenu(); renderSidebar();
  }
  function popToRoot() { const stack = S.stacks[S.tab]; if (stack.length > 1) { S.stacks[S.tab] = [stack[0]]; mountStack(); } }
  function resetTo(sc) { S.stacks[S.tab] = [S.stacks[S.tab][0]]; if (sc.type !== 'root') S.stacks[S.tab].push(sc); mountStack(); }

  // ---------- Screens ----------
  function buildScreen(sc) {
    const el = document.createElement('section'); el.className = 'screen'; el.dataset.type = sc.type;
    const stack = S.stacks[S.tab], depth = stack.indexOf(sc), prevTitle = depth > 0 ? screenTitle(stack[depth - 1]) : null;
    const title = screenTitle(sc);
    const showMenu = sc.type === 'folder' || sc.type === 'source' || sc.type === 'tag' || sc.type === 'favs' || sc.type === 'recent';
    const showGear = sc.type === 'root' || sc.type === 'changes';
    el.innerHTML = `<header class="nav"><div class="row">
        ${prevTitle != null ? `<button class="back" data-act="back">${I.back}<span>${esc(prevTitle.length > 14 ? 'Zurück' : prevTitle)}</span></button>` : '<span></span>'}
        <div class="title">${esc(title)}</div>
        <div class="actions">${showGear ? `<button data-act="settings" aria-label="Einstellungen">${I.gear}</button>` : ''}${showMenu ? `<button data-act="menu" aria-label="Ansicht und Sortierung">${I.more}</button>` : ''}</div>
      </div></header><div class="content"></div>`;
    const content = el.querySelector('.content'), nav = el.querySelector('.nav');
    content.innerHTML = `<h1 class="large">${esc(title)}</h1>` + screenBody(sc);
    const h1 = content.querySelector('.large');
    content.addEventListener('scroll', () => nav.classList.toggle('solid', content.scrollTop > (h1 ? h1.offsetTop + h1.offsetHeight - 6 : 28)), { passive: true });
    el.addEventListener('click', e => onClick(e, sc, el));
    el.addEventListener('input', e => { if (e.target.matches('.search input')) onSearch(e.target, sc, el); });
    attachSwipeBack(el, depth);
    return el;
  }
  function screenTitle(sc) {
    switch (sc.type) {
      case 'root': return 'Durchsuchen'; case 'recent': return 'Zuletzt'; case 'changes': return 'Änderungen';
      case 'source': return SOURCE_NAME[sc.source] || sc.source; case 'folder': return (S.byId.get(sc.id) || {}).name || '';
      case 'tag': return (TAGS.find(t => t.id === sc.tag) || {}).name || ''; case 'favs': return 'Favoriten'; default: return '';
    }
  }
  const searchHTML = (ph) => `<div class="search">${I.search}<input type="search" placeholder="${esc(ph || 'Suchen')}" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search"><button class="clear" data-act="clear" aria-label="Löschen">${I.x}</button></div>`;

  function screenBody(sc) {
    if (sc.type === 'root') return rootBody();
    if (sc.type === 'recent') return searchHTML('Zuletzt geändert durchsuchen') + `<div class="results">${recentBody()}</div>`;
    if (sc.type === 'changes') return changesBody();
    const items = listFor(sc);
    const ph = sc.type === 'folder' ? 'In „' + screenTitle(sc) + '“ suchen' : 'Suchen';
    return searchHTML(ph) + `<div class="results">${renderItems(items, sc)}</div>`;
  }
  function listFor(sc) {
    if (sc.type === 'source') return kidsOf(sc.source, null);
    if (sc.type === 'folder') { const f = S.byId.get(sc.id); return f ? kidsOf(f.source, f.id) : []; }
    if (sc.type === 'tag') { const t = TAGS.find(x => x.id === sc.tag); return S.items.filter(i => i.kind === 'file' && t.types.includes(i.type || 'other')); }
    if (sc.type === 'favs') return [...S.favs].map(id => S.byId.get(id)).filter(Boolean);
    return [];
  }
  function rootBody() { return searchHTML('Alle Orte durchsuchen') + `<div class="results">${rootResults()}</div>`; }
  function rootResults() {
    const srcCount = s => S.items.filter(i => i.source === s && i.kind === 'file').length;
    const places = S.sources.map(s => `<button class="item place ${s.kind}" data-act="source" data-source="${s.id}"><span class="ico">${I[s.kind] || I.drive}</span><span class="txt"><span class="name">${esc(s.name)}</span></span><span class="count">${srcCount(s.id)}</span><span class="chev">${I.chevron}</span></button>`).join('');
    const favs = [...S.favs].map(id => S.byId.get(id)).filter(Boolean);
    const favHTML = favs.length ? favs.map(it => itemRow(it, { showPath: true })).join('') : `<div class="item plain"><span class="txt"><span class="meta">Noch keine Favoriten – im Detail-Blatt mit ☆ markieren.</span></span></div>`;
    const tags = TAGS.map(t => { const n = S.items.filter(i => i.kind === 'file' && t.types.includes(i.type || 'other')).length; return n ? `<button class="item place tag" data-act="tag" data-tag="${t.id}"><span class="ico"><i style="background:${t.color}"></i></span><span class="txt"><span class="name">${esc(t.name)}</span></span><span class="count">${n}</span><span class="chev">${I.chevron}</span></button>` : ''; }).join('');
    return `<div class="section">Speicherorte</div><div class="group">${places}</div>
      <div class="section">Favoriten</div><div class="group">${favHTML}</div>
      <div class="section">Art</div><div class="group">${tags}</div>
      <p class="subtitle" style="margin:14px 16px 0">${S.items.filter(i => i.kind === 'file').length} Dateien in ${S.sources.length} Orten · Stand ${fmtDate(S.index.generated)}</p>`;
  }
  function recentBody(q) {
    let files = S.items.filter(i => i.kind === 'file' && i.modified);
    if (q) files = files.filter(i => match(i, q));
    files.sort((a, b) => new Date(b.modified) - new Date(a.modified)); files = files.slice(0, 120);
    if (!files.length) return `<div class="empty"><b>Nichts gefunden</b>Keine Datei passt zu „${esc(q)}“.</div>`;
    let out = '', last = null;
    for (const f of files) { const k = dayKey(f.modified); if (k !== last) { if (last) out += '</div>'; out += `<div class="section">${k}</div><div class="group filelist">`; last = k; } out += itemRow(f, { showPath: true }); }
    return out + '</div>';
  }
  function changesBody() {
    const gen = S.index.generated, old = (Date.now() - new Date(gen)) > 30 * 36e5;
    const ch = (S.index.changes || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    let list = '', last = null;
    for (const c of ch) { const k = dayKey(c.date); if (k !== last) { if (last) list += '</div>'; list += `<div class="section">${k}</div><div class="group">`; last = k; }
      const lbl = { new: 'Neu', modified: 'Geändert', deleted: 'Gelöscht', moved: 'Verschoben' }[c.type] || c.type; const it = S.byId.get(c.id);
      list += `<button class="item chg ${c.type}" data-act="${it ? 'detail' : ''}" data-id="${esc(c.id)}"><span class="ico">${lbl[0]}</span><span class="txt"><span class="name">${esc(c.name)}</span><span class="meta"><b>${lbl}</b> · ${esc(SOURCE_NAME[c.source] || c.source)} · ${fmtDate(c.date)}</span></span>${it ? `<span class="chev">${I.chevron}</span>` : ''}</button>`; }
    if (last) list += '</div>';
    const syncBtn = IS_IOS ? `<a class="open" href="shortcuts://run-shortcut?name=${encodeURIComponent('Explorer Sync')}">Jetzt aktualisieren</a>` : `<button class="open" data-act="sync-desktop">Jetzt aktualisieren</button>`;
    return `<div class="group"><div class="status ${old ? 'old' : ''}"><span class="light"></span><span class="st"><b>${old ? 'Index älter als 30 Stunden' : 'Index aktuell'}</b><span>Letzter Sync ${fmtDate(gen)} · ${ageText(gen)} · ${S.items.length} Einträge</span></span></div></div>
      <div class="btnrow">${syncBtn}</div>
      <p class="note">Der tägliche Sync läuft automatisch. Manuell: am iPhone startet der Button den Kurzbefehl „Explorer Sync“, am Desktop die Aktualisierung über Claude.</p>
      ${list || '<div class="empty"><b>Keine Änderungen</b>Seit dem letzten Sync hat sich nichts verändert.</div>'}`;
  }
  function renderItems(items, sc, q) {
    if (!items.length) return `<div class="empty"><b>${q ? 'Nichts gefunden' : 'Leer'}</b>${q ? 'Kein Eintrag passt zu „' + esc(q) + '“.' : 'Dieser Ordner enthält keine Einträge.'}</div>`;
    const sorted = sortItems(items), showPath = sc.type === 'tag' || sc.type === 'favs' || !!q;
    if (S.view === 'grid' && !q) return `<div class="grid">${sorted.map(it => itemCell(it)).join('')}</div>`;
    return `<div class="group filelist">${sorted.map(it => itemRow(it, { showPath })).join('')}</div><p class="subtitle" style="text-align:center;margin:12px 0 0">${plural(items.length, 'Objekt', 'Objekte')}</p>`;
  }
  const shortPath = it => { const p = pathOf(it); return (p.length > 3 ? ['…'].concat(p.slice(-2)) : p).join(' › '); };
  function itemRow(it, o = {}) {
    const isF = it.kind === 'folder';
    const when = it.due ? 'Fällig ' + fmtDate(it.due) : fmtDate(it.modified);
    const meta = isF ? (o.showPath ? shortPath(it) + ' · ' : '') + plural(countIn(it), 'Objekt', 'Objekte') : [shortPath(it), when].filter(Boolean).join(' · ');
    return `<button class="item" data-act="${isF ? 'folder' : 'detail'}" data-id="${esc(it.id)}"><span class="ico">${iconOf(it, 34)}</span><span class="txt"><span class="name">${esc(it.name)}</span><span class="meta">${esc(meta)}</span></span>${it.sample ? '<span class="badge sample">Beispiel</span>' : ''}${isF ? `<span class="chev">${I.chevron}</span>` : ''}</button>`;
  }
  function itemCell(it) {
    const isF = it.kind === 'folder';
    const meta = isF ? plural(countIn(it), 'Objekt', 'Objekte') : fmtDate(it.modified);
    return `<button class="cell" data-act="${isF ? 'folder' : 'detail'}" data-id="${esc(it.id)}"><span class="ico">${iconOf(it, 64)}</span><span class="name">${esc(it.name)}</span><span class="meta">${esc(meta)}</span></button>`;
  }
  function match(it, q) { const s = q.toLowerCase().split(/\s+/).filter(Boolean); const hay = (it.name + ' ' + (it.snippet || '') + ' ' + typeOf(it).label + ' ' + pathOf(it).join(' ')).toLowerCase(); return s.every(w => hay.includes(w)); }
  function onSearch(inp, sc, el) {
    const q = inp.value.trim(); inp.closest('.search').classList.toggle('has', !!q); const res = el.querySelector('.results');
    if (sc.type === 'recent') { res.innerHTML = recentBody(q); return; }
    if (!q) { res.innerHTML = sc.type === 'root' ? rootResults() : renderItems(listFor(sc), sc); return; }
    let pool;
    if (sc.type === 'root') pool = S.items; else if (sc.type === 'folder') pool = descendants(S.byId.get(sc.id)); else if (sc.type === 'source') pool = S.items.filter(i => i.source === sc.source); else pool = listFor(sc);
    const hits = pool.filter(i => match(i, q)).slice(0, 200);
    res.innerHTML = renderItems(hits, sc, q);
  }

  // ---------- Interaktion ----------
  function onClick(e, sc, el) {
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act, id = a.dataset.id;
    if (act === 'back') pop();
    else if (act === 'source') push({ type: 'source', source: a.dataset.source });
    else if (act === 'tag') push({ type: 'tag', tag: a.dataset.tag });
    else if (act === 'folder') push({ type: 'folder', id });
    else if (act === 'detail') { e.stopPropagation(); openSheet(S.byId.get(id)); }
    else if (act === 'open') openItem(S.byId.get(id));
    else if (act === 'menu') openMenu(a, sc, el);
    else if (act === 'clear') { const i = a.parentElement.querySelector('input'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); i.focus(); }
    else if (act === 'sync-desktop') toast('Desktop-Sync folgt in Phase 3 (Claude-Task)');
    else if (act === 'settings') openSettings();
  }
  function openMenu(anchor, sc, el) {
    closeMenu(); const r = anchor.getBoundingClientRect();
    const scrim = document.createElement('div'); scrim.className = 'scrim'; const m = document.createElement('div'); m.className = 'menu';
    m.style.top = (r.bottom + 6) + 'px'; m.style.right = Math.max(8, innerWidth - r.right) + 'px';
    const mi = (k, v, lbl) => `<button class="mi ${S[k] === v ? 'on' : ''}" data-k="${k}" data-v="${v}"><span>${lbl}</span><span class="chk">${I.check}</span></button>`;
    m.innerHTML = `${mi('view', 'list', 'Liste')}${mi('view', 'grid', 'Symbole')}<div class="gap"></div><div class="head">Sortieren nach</div>${mi('sort', 'name', 'Name')}${mi('sort', 'date', 'Datum')}${mi('sort', 'size', 'Größe')}${mi('sort', 'type', 'Art')}<div class="gap"></div>${mi('dir', 'asc', 'Aufsteigend')}${mi('dir', 'desc', 'Absteigend')}`;
    m.addEventListener('click', ev => { const b = ev.target.closest('.mi'); if (!b) return; S[b.dataset.k] = b.dataset.v; store.set(b.dataset.k, b.dataset.v); closeMenu(); const inp = el.querySelector('.search input'); if (inp && inp.value.trim()) onSearch(inp, sc, el); else el.querySelector('.results').innerHTML = sc.type === 'recent' ? recentBody() : renderItems(listFor(sc), sc); });
    scrim.addEventListener('click', closeMenu); document.body.append(scrim, m); S.menu = [scrim, m];
  }
  function closeMenu() { if (S.menu) { S.menu.forEach(x => x.remove()); S.menu = null; } }

  function openSheet(it) {
    if (!it) return; closeSheet(true);
    const t = openTarget(it), isF = it.kind === 'folder', fav = S.favs.has(it.id), path = pathOf(it);
    const scrim = document.createElement('div'); scrim.className = 'sheet-scrim'; const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog');
    const kv = (k, v) => v ? `<div class="kv"><span>${k}</span><span>${esc(v)}</span></div>` : '';
    sh.innerHTML = `<div class="grab"></div><div class="shead"><button class="done" style="justify-self:start;color:${fav ? 'var(--warn)' : 'var(--accent)'}" data-act="fav" aria-label="Favorit">${fav ? I.starF : I.star}</button><span class="stitle">Details</span><button class="done" data-act="close">Fertig</button></div>
      <div class="sbody">
        <div class="hero"><span class="ico">${isF ? folderSVG(96) : (it.thumb ? `<img src="${it.thumb}" alt="">` : typeOf(it).ico(96, it))}</span><div class="hname">${esc(it.name)}</div><div class="hmeta">${isF ? plural(countIn(it), 'Objekt', 'Objekte') : [typeOf(it).label, fmtSize(it.size)].filter(Boolean).join(' · ')}${it.sample ? ' · Beispiel' : ''}</div></div>
        ${isF ? `<button class="open" data-act="goto">Ordner anzeigen</button>` : ''}
        <a class="open ${isF ? 'secondary' : ''}" href="${esc(t.url)}" ${t.ext ? 'target="_blank" rel="noopener"' : ''} data-act="openlink">${I.link}<span>${esc(t.label)}</span></a>
        <div class="btnrow">${altOpens(it).map(a => `<a class="open secondary small" href="${esc(a.url)}" ${a.ext ? 'target="_blank" rel="noopener"' : ''} data-act="openlink">${esc(a.label)}</a>`).join('')}<button class="open secondary small" data-act="share">Teilen</button></div>
        ${t.hint ? `<p class="note">${esc(t.hint)}</p>` : ''}
        ${it.snippet ? `<div class="group"><div class="snippet">${esc(it.snippet)}</div></div>` : ''}
        <div class="section">Informationen</div><div class="group">
          ${kv('Art', isF ? 'Ordner' : typeOf(it).label)}${kv('Größe', it.size != null ? fmtSize(it.size) : '')}${kv('Geändert', fmtDate(it.modified, true))}${kv('Erstellt', fmtDate(it.created, true))}${kv('Fällig', it.due ? fmtDate(it.due, true) : '')}
          ${kv('Ort', path.join(' › '))}${kv('Quelle', SOURCE_NAME[it.source] || it.source)}${it.shared ? kv('Freigabe', 'Mit dir geteilt') : ''}
        </div>
        <div class="group" style="margin-top:8px"><button class="item plain" data-act="copy"><span class="txt"><span class="name" style="color:var(--accent)">Link kopieren</span></span></button></div>
      </div>`;
    sh.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a) return; const act = a.dataset.act;
      if (act === 'close') closeSheet();
      else if (act === 'fav') { if (S.favs.has(it.id)) S.favs.delete(it.id); else S.favs.add(it.id); store.set('favs', [...S.favs]); a.innerHTML = S.favs.has(it.id) ? I.starF : I.star; a.style.color = S.favs.has(it.id) ? 'var(--warn)' : 'var(--accent)'; toast(S.favs.has(it.id) ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt'); refreshRoot(); }
      else if (act === 'goto') { closeSheet(); push({ type: 'folder', id: it.id }); }
      else if (act === 'openlink') { if (it.sample) { e.preventDefault(); toast('Beispiel-Eintrag – echte Daten kommen mit dem Sync'); return; } S.opened = [it.id].concat(S.opened.filter(x => x !== it.id)).slice(0, 30); store.set('opened', S.opened); if (!t.ext) { e.preventDefault(); location.href = t.url; } }
      else if (act === 'share') { if (navigator.share) navigator.share({ title: it.name, text: pathOf(it).join(' › '), url: t.url }).catch(() => {}); else (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t.url) : Promise.reject()).then(() => toast('Link kopiert')).catch(() => toast(t.url)); }
      else if (act === 'copy') { const txt = t.url; (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Link kopiert')).catch(() => toast(txt)); }
    });
    scrim.addEventListener('click', () => closeSheet());
    // Ziehen zum Schließen (mobil)
    let y0 = null; sh.addEventListener('touchstart', e => { if (sh.querySelector('.sbody').scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
    sh.addEventListener('touchmove', e => { if (y0 == null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) { sh.style.transform = `translateY(${dy}px)`; sh.style.transition = 'none'; } }, { passive: true });
    sh.addEventListener('touchend', e => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null; sh.style.transition = ''; if (dy > 120) closeSheet(); else sh.style.transform = ''; });
    document.body.append(scrim, sh); S.sheet = [scrim, sh];
  }
  // ---------- Einstellungen ----------
  const BIO_NAME = IS_IOS ? 'Face ID' : IS_WIN ? 'Windows Hello' : 'Biometrie';
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  const toB64 = a => btoa(String.fromCharCode(...new Uint8Array(a)));
  async function bioAvailable() { try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; } }
  async function bioEnroll() {
    const cred = await navigator.credentials.create({ publicKey: { challenge: rnd(32), rp: { name: 'Explorer', id: location.hostname }, user: { id: rnd(16), name: 'explorer', displayName: 'Explorer' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' }, timeout: 60000, attestation: 'none' } });
    store.set('bio', toB64(cred.rawId)); return true;
  }
  async function bioVerify() {
    const id = store.get('bio', null); if (!id) return true;
    await navigator.credentials.get({ publicKey: { challenge: rnd(32), rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: b64(id) }], userVerification: 'required', timeout: 60000 } });
    return true;
  }
  function openSettings() {
    closeSheet(true);
    const scrim = document.createElement('div'); scrim.className = 'sheet-scrim'; const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog');
    const bio = !!store.get('bio', null), glass = store.get('design', 'glass') === 'glass';
    const row = (lbl, right, act, sub) => `<button class="item plain" data-act="${act}"><span class="txt"><span class="name">${lbl}</span>${sub ? `<span class="meta">${sub}</span>` : ''}</span>${right}</button>`;
    const sw = on => `<span class="switch ${on ? 'on' : ''}"><i></i></span>`;
    sh.innerHTML = `<div class="grab"></div><div class="shead"><span></span><span class="stitle">Einstellungen</span><button class="done" data-act="close">Fertig</button></div><div class="sbody">
      <div class="section">Darstellung</div><div class="group">${row('Glas-Design', sw(glass), 'design', 'Schwebende Tab-Leiste, Suche unten, Glas-Materialien')}</div>
      <div class="section">Sicherheit</div><div class="group">${row('Mit ' + BIO_NAME + ' schützen', sw(bio), 'bio', 'Beim Start entsperren statt Passphrase')}${row('Passphrase vergessen', '', 'forget', 'Beim nächsten Start neu eingeben')}</div>
      <div class="section">Index</div><div class="group"><div class="kv"><span>Stand</span><span>${fmtDate(S.index.generated, true)}</span></div><div class="kv"><span>Einträge</span><span>${S.items.length}</span></div><div class="kv"><span>Quellen</span><span>${S.sources.map(x => x.name).join(', ')}</span></div></div>
      <p class="note">Explorer · PWA · ${STANDALONE ? 'installiert' : 'im Browser'}</p></div>`;
    sh.addEventListener('click', async e => { const a = e.target.closest('[data-act]'); if (!a) return; const act = a.dataset.act;
      if (act === 'close') closeSheet();
      else if (act === 'design') { const g = store.get('design', 'glass') !== 'glass'; store.set('design', g ? 'glass' : 'classic'); applyDesign(); a.querySelector('.switch').classList.toggle('on', g); }
      else if (act === 'bio') { if (store.get('bio', null)) { store.del('bio'); a.querySelector('.switch').classList.remove('on'); toast(BIO_NAME + ' deaktiviert'); return; } if (!(await bioAvailable())) { toast(BIO_NAME + ' ist hier nicht verfügbar'); return; } try { await bioEnroll(); a.querySelector('.switch').classList.add('on'); toast('Beim nächsten Start mit ' + BIO_NAME); } catch (err) { toast('Abgebrochen'); } }
      else if (act === 'forget') { store.del('pass'); store.del('bio'); toast('Passphrase vergessen'); closeSheet(); setTimeout(() => location.reload(), 400); } });
    scrim.addEventListener('click', () => closeSheet()); document.body.append(scrim, sh); S.sheet = [scrim, sh];
  }
  function offerBio() {
    const scrim = document.createElement('div'); scrim.className = 'sheet-scrim'; const sh = document.createElement('div'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog');
    sh.innerHTML = `<div class="grab"></div><div class="sbody"><div class="hero"><span class="ico" style="color:var(--accent)">${I.face.replace('width="20" height="20"', 'width="72" height="72"')}</span><div class="hname">Mit ${BIO_NAME} entsperren?</div><div class="hmeta">Die Passphrase bleibt auf diesem Gerät gespeichert. Beim Start genügt dann ${BIO_NAME}.</div></div><button class="open" data-act="yes">${BIO_NAME} aktivieren</button><button class="open secondary" data-act="no">Später</button></div>`;
    sh.addEventListener('click', async e => { const a = e.target.closest('[data-act]'); if (!a) return; if (a.dataset.act === 'yes') { try { await bioEnroll(); toast(BIO_NAME + ' aktiviert'); } catch (err) { toast('Abgebrochen'); } } closeSheet(); });
    scrim.addEventListener('click', () => closeSheet()); document.body.append(scrim, sh); S.sheet = [scrim, sh];
  }
  function applyDesign() { document.body.classList.toggle('glass', store.get('design', 'glass') === 'glass'); }

  function closeSheet(now) { if (!S.sheet) return; const [sc, sh] = S.sheet; S.sheet = null; if (now) { sc.remove(); sh.remove(); return; } sh.classList.add('closing'); sc.style.opacity = 0; sc.style.transition = 'opacity .25s'; setTimeout(() => { sc.remove(); sh.remove(); }, 280); }
  function refreshRoot() { const rootScreen = stackEl() && stackEl().querySelector('.screen[data-type="root"]'); if (rootScreen) { const inp = rootScreen.querySelector('.search input'); if (!inp.value.trim()) rootScreen.querySelector('.results').innerHTML = rootResults(); } const f = stackEl() && stackEl().querySelector('.screen[data-type="favs"] .results'); if (f) f.innerHTML = renderItems(listFor({ type: 'favs' }), { type: 'favs' }); renderSidebar(); }

  let toastT; function toast(msg) { let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2200); }

  // Wisch-Geste zurück (linker Rand)
  function attachSwipeBack(el, depth) {
    if (depth === 0) return; let x0 = null, y0 = null, w = 0, active = false, prev = null;
    el.addEventListener('touchstart', e => { const t = e.touches[0]; if (t.clientX > 28) return; x0 = t.clientX; y0 = t.clientY; w = el.offsetWidth; active = false; prev = el.previousElementSibling; }, { passive: true });
    el.addEventListener('touchmove', e => { if (x0 == null) return; const t = e.touches[0], dx = t.clientX - x0, dy = Math.abs(t.clientY - y0); if (!active) { if (dx > 10 && dx > dy) { active = true; el.classList.add('dragging'); if (prev) prev.classList.add('dragging'); } else if (dy > 10) { x0 = null; return; } }
      if (active) { const d = Math.max(0, dx); el.style.transform = `translateX(${d}px)`; if (prev) prev.style.transform = `translateX(${-28 + 28 * (d / w)}%)`; } }, { passive: true });
    const end = e => { if (x0 == null) return; const dx = (e.changedTouches ? e.changedTouches[0].clientX : 0) - x0; x0 = null; if (!active) return; active = false;
      el.classList.remove('dragging'); if (prev) prev.classList.remove('dragging'); el.style.transition = 'transform .25s cubic-bezier(.32,.72,0,1)'; if (prev) prev.style.transition = 'transform .25s cubic-bezier(.32,.72,0,1)';
      if (dx > w * 0.33) { el.style.transform = `translateX(${w}px)`; if (prev) prev.style.transform = 'translateX(0)'; setTimeout(() => { S.stacks[S.tab].pop(); el.remove(); if (prev) { prev.classList.remove('under'); prev.style.transform = ''; prev.style.transition = ''; prev.style.filter = ''; } renderSidebar(); }, 250); }
      else { el.style.transform = ''; if (prev) prev.style.transform = ''; setTimeout(() => { el.style.transition = ''; if (prev) prev.style.transition = ''; }, 260); } };
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
  }

  // ---------- Sidebar (Desktop) ----------
  function renderSidebar() {
    const sb = document.getElementById('sidebar'); if (!sb) return;
    const cur = S.stacks[S.tab][S.stacks[S.tab].length - 1] || {};
    const on = (t, k, v) => cur.type === t && (k == null || cur[k] === v) ? 'on' : '';
    const srcCount = s => S.items.filter(i => i.source === s && i.kind === 'file').length;
    sb.innerHTML = `<div class="brand"><span class="mark"></span>Explorer</div>
      <button class="item place recent ${S.tab === 'recent' ? 'on' : ''}" data-side="recent"><span class="ico">${I.clock}</span><span class="txt"><span class="name">Zuletzt</span></span></button>
      <button class="item place ${S.tab === 'browse' && on('root') ? 'on' : ''}" data-side="root"><span class="ico" style="background:var(--accent)">${I.tabBrowse.replace('width="26" height="26"', 'width="14" height="14"').replace('stroke="currentColor"', 'stroke="#fff"')}</span><span class="txt"><span class="name">Durchsuchen</span></span></button>
      <button class="item place ${S.tab === 'changes' ? 'on' : ''}" data-side="changes"><span class="ico" style="background:var(--purple)">${I.tabChanges.replace('width="26" height="26"', 'width="14" height="14"').replace('stroke="currentColor"', 'stroke="#fff"')}</span><span class="txt"><span class="name">Änderungen</span></span></button>
      <div class="section">Speicherorte</div>${S.sources.map(s => `<button class="item place ${s.kind} ${S.tab === 'browse' && on('source', 'source', s.id) ? 'on' : ''}" data-side="source" data-source="${s.id}"><span class="ico">${I[s.kind] || I.drive}</span><span class="txt"><span class="name">${esc(s.name)}</span></span><span class="count">${srcCount(s.id)}</span></button>`).join('')}
      <div class="section">Favoriten</div>${[...S.favs].map(id => S.byId.get(id)).filter(Boolean).map(it => `<button class="item ${S.tab === 'browse' && on('folder', 'id', it.id) ? 'on' : ''}" data-side="${it.kind === 'folder' ? 'folder' : 'detail'}" data-id="${esc(it.id)}"><span class="ico">${iconOf(it, 20)}</span><span class="txt"><span class="name">${esc(it.name)}</span></span></button>`).join('') || '<div class="item plain"><span class="txt"><span class="meta">Keine Favoriten</span></span></div>'}
      <div class="section">Art</div>${TAGS.map(t => `<button class="item place tag ${S.tab === 'browse' && on('tag', 'tag', t.id) ? 'on' : ''}" data-side="tag" data-tag="${t.id}"><span class="ico"><i style="background:${t.color}"></i></span><span class="txt"><span class="name">${esc(t.name)}</span></span></button>`).join('')}`;
    sb.onclick = e => { const b = e.target.closest('[data-side]'); if (!b) return; const k = b.dataset.side;
      if (k === 'recent' || k === 'changes') { switchTab(k); return; }
      if (S.tab !== 'browse') { S.tab = 'browse'; store.set('tab', 'browse'); }
      if (k === 'root') resetTo({ type: 'root' }); else if (k === 'source') resetTo({ type: 'source', source: b.dataset.source }); else if (k === 'tag') resetTo({ type: 'tag', tag: b.dataset.tag }); else if (k === 'folder') resetTo({ type: 'folder', id: b.dataset.id }); else if (k === 'detail') openSheet(S.byId.get(b.dataset.id)); };
  }

  // ---------- Start ----------
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); closeSheet(); } });
  (async function start() {
    applyDesign();
    const saved = store.get('pass', null);
    if (saved && store.get('bio', null)) {
      const gate = () => { $app.innerHTML = `<div class="lock"><div class="icon">${folderSVG(44)}</div><h1>Explorer</h1><p>Gesperrt</p><button class="btn" id="bio">${I.face}<span style="margin-left:8px">Mit ${BIO_NAME} entsperren</span></button><button class="link" id="usepass">Passphrase verwenden</button></div>`;
        document.getElementById('bio').onclick = async () => { try { await bioVerify(); await boot(saved, false); } catch (e) { toast(e && e.message === 'fetch' ? 'Index nicht erreichbar' : 'Nicht erkannt'); } };
        document.getElementById('usepass').onclick = () => renderLock(); };
      gate(); try { await bioVerify(); await boot(saved, false); } catch (e) { /* bleibt am Gate */ }
      return;
    }
    if (saved) { try { await boot(saved, false); return; } catch (e) { store.del('pass'); renderLock(e && e.message === 'fetch' ? 'Index nicht erreichbar – Netz prüfen.' : 'Passphrase hat sich geändert.'); return; } }
    renderLock();
  })();
})();
