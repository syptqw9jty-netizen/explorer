// Spur — Oberfläche. Ein Bildschirm, eine Handlung: tippen und erzählen.
import * as store from './store.js';
import { Session, speak, speechSupported, ttsSupported, signal } from './audio.js';
import { composeLocal, composeAI, followUpQuestion, transcribeRemote, QUESTIONS, CATEGORY_LABELS, dayPart } from './ai.js';
import { createOrb } from './orb.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const I = {
  mic: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  back: '<path d="m15 18-6-6 6-6"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="m5 12 5 5L20 7"/>',
  play: '<path d="M7 4.5v15l12-7.5-12-7.5Z" fill="currentColor"/>', pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', pen: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m14 6 4 4"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', next: '<path d="m9 18 6-6-6-6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'
};
const icon = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

const DEFAULTS = () => ({
  persons: [{ id: 'me', name: 'Ich', self: true }], lastFor: ['me'], mode: 'erzaehlen',
  tone: 40, perspective: 'ich', audience: 'selbst',
  sensitive: { health: true, emotions: true, conflicts: false, places: false },
  extraNames: [], ai: { provider: 'none', key: '', model: '' }, keepAudio: true, autoLockMin: 3, userName: ''
});

const S = { key: null, settings: null, entries: [], tab: 'heute', session: null, orb: null, filter: 'alle', hiddenAt: 0, busy: false };

/* ---------- Grundgerüst ---------- */
document.body.dataset.daypart = dayPart(new Date());
document.body.insertAdjacentHTML('afterbegin', '<div class="ambient"><i></i><i></i><i></i></div><div class="grain"></div>');
const app = $('#app');

function toast(msg, ms = 2800) {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast glass'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms);
}

async function save() { await store.saveSettings(S.key, S.settings); }
const personName = id => (S.settings.persons.find(p => p.id === id) || {}).name || '—';
const fmtTime = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtDate = (ts, o) => new Date(ts).toLocaleDateString('de-DE', o);

/* ---------- Einrichtung ---------- */
function gateShell(inner) { return `<div class="gate">${inner}</div>`; }
const MARK = `<svg class="mark" viewBox="0 0 92 92" aria-hidden="true"><defs><radialGradient id="g" cx="35%" cy="28%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="l" x1="0" x2="1"><stop offset="0" stop-color="#ff8a4c"/><stop offset=".5" stop-color="#c2417a"/><stop offset="1" stop-color="#6d4bff"/></linearGradient></defs><circle cx="46" cy="46" r="44" fill="url(#l)" opacity=".9"/><path d="M14 52c8-10 14-10 20 0s12 10 18-2 13-14 26 2" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".95"/><circle cx="46" cy="46" r="44" fill="url(#g)"/></svg>`;

function renderSetup(step = 1, tmp = {}) {
  const steps = `<div class="steps">${[1, 2, 3].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>`;
  if (step === 1) {
    app.innerHTML = gateShell(`${MARK}<h1>Spur</h1><p>Erzähl einfach. Spur hört zu und schreibt daraus dein Tagebuch, für dich und für die Menschen, die dir wichtig sind.</p>
      <button class="btn primary" id="go">Beginnen</button>
      <div class="fine">Alles bleibt verschlüsselt auf diesem Gerät. Kein Konto, kein Server.</div>`);
    $('#go').onclick = () => renderSetup(2);
  } else if (step === 2) {
    app.innerHTML = gateShell(`${steps}<h1>Dein Schlüssel</h1><p>Wähle einen Passcode. Nur damit lassen sich deine Einträge öffnen. Wir können ihn nicht wiederherstellen.</p>
      <input class="field" id="p1" type="password" inputmode="text" autocomplete="new-password" placeholder="Passcode (mind. 6 Zeichen)">
      <input class="field" id="p2" type="password" autocomplete="new-password" placeholder="Wiederholen">
      <div class="err" id="err"></div><button class="btn primary" id="go">Weiter</button>`);
    $('#p1').focus();
    const go = async () => {
      const a = $('#p1').value, b = $('#p2').value;
      if (a.length < 6) return fail('Mindestens 6 Zeichen.'); if (a !== b) return fail('Die beiden Eingaben stimmen nicht überein.');
      $('#go').textContent = 'Schlüssel entsteht …';
      S.key = await store.setup(a); S.settings = DEFAULTS(); await save(); renderSetup(3);
    };
    const fail = m => { $('#err').textContent = m; $('.gate').classList.remove('shake'); void $('.gate').offsetWidth; $('.gate').classList.add('shake'); };
    $('#go').onclick = go; $('#p2').onkeydown = e => { if (e.key === 'Enter') go(); };
  } else {
    app.innerHTML = gateShell(`${steps}<h1>Für wen?</h1><p>Wie heißt du, und für wen möchtest du Spuren sammeln? Namen bleiben auf diesem Gerät.</p>
      <input class="field" id="me" type="text" autocomplete="given-name" placeholder="Dein Vorname">
      <input class="field" id="kid" type="text" autocomplete="off" placeholder="Name deines Kindes (optional)">
      <input class="field" id="kid2" type="text" autocomplete="off" placeholder="Weiteres Kind (optional)">
      <button class="btn primary" id="go">Fertig</button>`);
    $('#go').onclick = async () => {
      const me = $('#me').value.trim(); S.settings.userName = me;
      [$('#kid').value, $('#kid2').value].map(v => v.trim()).filter(Boolean).forEach(n => S.settings.persons.push({ id: uid(), name: n }));
      await save(); S.entries = []; renderMain();
    };
  }
}

/* ---------- Sperre ---------- */
function renderLock(msg = '') {
  stopOrb();
  app.innerHTML = gateShell(`${MARK}<h1>Spur</h1><p>${h(msg) || 'Deine Spuren sind verschlossen.'}</p>
    <input class="field" id="pc" type="password" autocomplete="current-password" placeholder="Passcode">
    <div class="err" id="err"></div><button class="btn primary" id="go">Öffnen</button>
    <button class="link fine" id="reset" style="margin-top:28px">Passcode vergessen?</button>`);
  const pc = $('#pc'); setTimeout(() => pc.focus(), 300);
  const go = async () => {
    $('#go').textContent = 'Öffne …';
    try {
      S.key = await store.unlock(pc.value);
      const d = await store.loadAll(S.key); S.settings = Object.assign(DEFAULTS(), d.settings || {}); S.entries = d.entries;
      S.settings.sensitive = Object.assign(DEFAULTS().sensitive, S.settings.sensitive); S.settings.ai = Object.assign(DEFAULTS().ai, S.settings.ai);
      renderMain();
    } catch (e) {
      $('#go').textContent = 'Öffnen'; $('#err').textContent = 'Das war nicht der richtige Passcode.'; pc.value = '';
      $('.gate').classList.remove('shake'); void $('.gate').offsetWidth; $('.gate').classList.add('shake');
    }
  };
  $('#go').onclick = go; pc.onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#reset').onclick = async () => {
    if (!confirm('Ohne Passcode lassen sich die Einträge nicht entschlüsseln. Alles löschen und neu beginnen?')) return;
    await store.wipe(); renderSetup(1);
  };
}

function lockNow() {
  if (S.session) return;
  S.key = null; S.settings = null; S.entries = []; closeSheet(true); renderLock();
}
document.addEventListener('visibilitychange', () => {
  if (!S.key) return;
  if (document.hidden) S.hiddenAt = Date.now();
  else if (S.hiddenAt && Date.now() - S.hiddenAt > (S.settings.autoLockMin || 3) * 60000) lockNow();
});

/* ---------- Hauptansicht ---------- */
function stopOrb() { if (S.orb) { S.orb.destroy(); S.orb = null; } }

function renderMain() {
  stopOrb();
  app.innerHTML = `
    <header class="top"><div class="brand">Spur</div><button class="iconbtn glass" id="gear" aria-label="Einstellungen">${icon('gear')}</button></header>
    <section class="view" id="v-heute"></section>
    <section class="view" id="v-chronik"></section>
    <section class="view" id="v-suche"></section>
    <nav class="tabs glass" role="tablist">
      <button data-tab="heute">${icon('mic')}Erzählen</button>
      <button data-tab="chronik">${icon('book')}Chronik</button>
      <button data-tab="suche">${icon('search')}Suche</button>
    </nav>`;
  $('#gear').onclick = openSettings;
  $$('.tabs button').forEach(b => b.onclick = () => go(b.dataset.tab));
  renderToday(); go(S.tab);
}

function go(tab) {
  S.tab = tab;
  $$('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-selected', b.dataset.tab === tab); });
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + tab));
  if (tab === 'chronik') renderChronik();
  if (tab === 'suche') renderSearch();
}

/* ---------- Erzählen ---------- */
const MODES = [['erzaehlen', 'Erzählen'], ['raum', 'Raum'], ['interview', 'Interview']];
const MODE_HINT = {
  erzaehlen: 'Sprich frei. Spur ordnet es für dich.',
  raum: 'Leg das Telefon hin. Spur hört eurem Gespräch zu.',
  interview: 'Spur fragt, du antwortest. Ganz in Ruhe.'
};
function greeting() {
  const p = dayPart(new Date()); const n = S.settings.userName ? ', ' + S.settings.userName : '';
  return ({ morgen: 'Guten Morgen', mittag: 'Hallo', nachmittag: 'Guten Tag', abend: 'Guten Abend', nacht: 'Gute Nacht' }[p]) + n + '.';
}

function renderToday() {
  const st = S.settings; const v = $('#v-heute'); if (!v) return;
  stopOrb();
  if (!st.lastFor.some(id => st.persons.find(p => p.id === id))) st.lastFor = ['me'];
  v.innerHTML = `<div class="wrap today">
    <div class="date">${fmtDate(Date.now(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    <div class="greet" id="greet">${h(greeting())}</div>
    <div class="seg glass pill" role="radiogroup" id="modes">${MODES.map(([k, l]) => `<button data-m="${k}" class="${st.mode === k ? 'on' : ''}" role="radio" aria-checked="${st.mode === k}">${l}</button>`).join('')}</div>
    <div class="forrow" id="forrow"><span class="lbl">für</span>${st.persons.map(p => `<button class="chip glass ${st.lastFor.includes(p.id) ? 'on' : ''}" data-p="${p.id}">${h(p.self ? (st.userName || 'Mich') : p.name)}</button>`).join('')}</div>
    <div class="question" id="question" aria-live="polite"></div>
    <div class="stage"><button class="orb" id="orb" aria-label="Aufnahme starten"><div class="sphere"></div><canvas></canvas><span class="label" id="orblabel">Tippen zum ${st.mode === 'interview' ? 'Beginnen' : 'Erzählen'}</span><i class="ring-hint"></i></button></div>
    <div class="live" id="live" aria-live="polite"></div>
    <div class="controls idle" id="controls"><div class="hint" id="hint">${MODE_HINT[st.mode]}</div><button class="link" id="note">${icon('pen')} Etwas aufschreiben</button></div>
  </div>`;
  S.orb = createOrb($('#orb canvas'));
  $$('#modes button').forEach(b => b.onclick = () => { if (S.session) return; st.mode = b.dataset.m; save(); renderToday(); });
  $$('#forrow .chip').forEach(b => b.onclick = () => {
    if (S.session) return;
    const id = b.dataset.p; const set = new Set(st.lastFor);
    set.has(id) ? set.delete(id) : set.add(id); if (!set.size) set.add(id);
    st.lastFor = [...set]; save(); $$('#forrow .chip').forEach(c => c.classList.toggle('on', st.lastFor.includes(c.dataset.p)));
  });
  $('#orb').onclick = () => S.session ? finish() : (S.busy ? null : begin());
  $('#note').onclick = openNote;
}

let timerH = 0, interviewH = 0, qIndex = 0, interviewState = null;

async function begin() {
  const st = S.settings;
  const live = $('#live'); live.innerHTML = '';
  let finals = [];
  const s = new Session({
    keepAudio: st.keepAudio,
    onInterim: t => { live.innerHTML = finals.slice(-2).map(x => `<span>${h(x)}</span>`).join(' ') + (t ? ` <em>${h(t)}</em>` : ''); },
    onFinal: seg => { if (seg.speaker !== 'frage') { finals.push(seg.text); live.innerHTML = finals.slice(-3).map(x => `<span>${h(x)}</span>`).join(' '); } },
    onState: x => { if (x.speech === 'unavailable') toast('Spracherkennung nicht verfügbar. Die Aufnahme läuft weiter.'); }
  });
  try { await s.start(); }
  catch (e) { toast('Ohne Mikrofon geht es nicht. Bitte Zugriff erlauben.'); return; }
  S.session = s; document.body.classList.add('rec');
  S.orb.set('listening');
  $('#orb').setAttribute('aria-label', 'Aufnahme beenden');
  $('#greet').style.opacity = .35; $('#modes').style.opacity = .35; $('#forrow').style.opacity = .35;
  const label = $('#orblabel');
  timerH = setInterval(() => { label.innerHTML = `<b>${fmtTime(s.elapsed())}</b>${st.mode === 'raum' ? 'hört zu' : 'Tippen zum Beenden'}`; }, 250);
  const ctr = $('#controls'); ctr.classList.remove('idle');
  ctr.innerHTML = `<button class="btn glass round danger" id="discard" aria-label="Verwerfen">${icon('x')}</button>${st.mode === 'interview' ? `<button class="btn glass pill" id="nextq">Nächste Frage ${icon('next')}</button>` : ''}<button class="btn primary" id="done">${icon('check')} Fertig</button>`;
  $('#done').onclick = finish; $('#discard').onclick = discard;
  if (!speechSupported) toast('Dieser Browser erkennt keine Sprache. Die Aufnahme wird trotzdem gespeichert.');
  if (st.mode === 'interview') startInterview(s);
}

function questionSet() {
  const forKids = S.settings.lastFor.some(id => id !== 'me');
  return forKids ? QUESTIONS.kind : QUESTIONS.selbst;
}
async function ask(s, text) {
  const q = $('#question'); if (!q) return;
  q.style.opacity = 0; await new Promise(r => setTimeout(r, 250)); q.textContent = text; q.style.opacity = 1;
  s.addSegment(text, 'frage');
  if (ttsSupported) { s.pauseRecognition(); S.orb.set('speaking'); await speak(text); if (!S.session) return; S.orb.set('listening'); s.resumeRecognition(); }
  s.resetHeard();
}
async function nextQuestion(s) {
  if (interviewState === 'asking') return; interviewState = 'asking';
  const set = questionSet(); let text = null;
  if (S.settings.ai.provider !== 'none' && qIndex > 0 && qIndex % 2 === 1) {
    const recent = s.segments.slice(-4).filter(x => x.speaker !== 'frage');
    if (recent.length) { try { S.orb.set('thinking'); text = await followUpQuestion(S.settings, personsFor(), recent); } catch (e) { console.warn(e); } }
  }
  if (!text) { text = set[Math.min(Math.floor(qIndex / (S.settings.ai.provider !== 'none' ? 2 : 1)), set.length - 1)]; }
  qIndex++;
  if (!S.session) return;
  await ask(s, text); interviewState = 'listening';
}
function startInterview(s) {
  qIndex = 0; interviewState = null; nextQuestion(s);
  $('#nextq').onclick = () => nextQuestion(s);
  interviewH = setInterval(() => { if (interviewState === 'listening' && s.heardSomething() && s.silenceMs() > 4200) nextQuestion(s); }, 500);
}

function endUI() {
  clearInterval(timerH); clearInterval(interviewH); interviewState = null;
  if (ttsSupported) speechSynthesis.cancel();
  document.body.classList.remove('rec');
}

async function discard() {
  if (!confirm('Diese Aufnahme verwerfen?')) return;
  const s = S.session; S.session = null; endUI(); await s.stop(); renderToday();
}

const personsFor = () => S.settings.lastFor.map(id => S.settings.persons.find(p => p.id === id)).filter(Boolean);

async function finish() {
  const s = S.session; if (!s) return; S.session = null; S.busy = true; endUI();
  S.orb.set('thinking');
  $('#orblabel').innerHTML = 'Wird zur Spur …'; $('#controls').innerHTML = ''; $('#question').textContent = '';
  const res = await s.stop();
  const entry = {
    id: uid(), kind: 'aufnahme', createdAt: Date.now() - res.durationMs, durationMs: res.durationMs, mode: S.settings.mode,
    personIds: [...S.settings.lastFor], segments: res.segments, hasAudio: !!res.blob
  };
  if (res.blob) await store.saveAudio(S.key, entry.id, res.blob);
  const voice = res.segments.filter(x => x.speaker !== 'frage');
  if (!voice.length && res.blob && S.settings.ai.provider === 'mistral') {
    try { $('#orblabel').innerHTML = 'Wird verschriftlicht …'; entry.segments = await transcribeRemote(S.settings, res.blob); } catch (e) { toast(e.message); }
  }
  await compose(entry);
  await store.saveEntry(S.key, entry); S.entries.unshift(entry);
  S.busy = false; renderToday(); openEntry(entry.id);
}

async function compose(entry) {
  const ctx = { segments: entry.segments, settings: S.settings, persons: entry.personIds.map(id => S.settings.persons.find(p => p.id === id)).filter(Boolean), createdAt: entry.createdAt, mode: entry.mode };
  if (!ctx.persons.length) ctx.persons = [S.settings.persons[0]];
  let out;
  if (!entry.segments.filter(x => x.speaker !== 'frage').length) {
    out = { title: composeLocal(ctx).title, versions: ctx.persons.map(p => ({ for: p.id, paragraphs: [] })), topics: [], observations: [], composer: 'lokal' };
    entry.note = entry.hasAudio ? 'Kein Text erkannt. Die Aufnahme ist gespeichert.' : 'Kein Text erkannt.';
  } else if (S.settings.ai.provider !== 'none' && S.settings.ai.key) {
    try { out = await composeAI(ctx); delete entry.note; }
    catch (e) { console.warn(e); toast('KI nicht erreichbar, lokal geordnet.'); out = composeLocal(ctx); entry.note = 'Lokal geordnet. ' + e.message; }
  } else { out = composeLocal(ctx); delete entry.note; }
  Object.assign(entry, out, { composedAt: Date.now(), style: { tone: S.settings.tone, perspective: S.settings.perspective } });
}

/* ---------- Notiz ---------- */
function openNote() {
  const st = S.settings;
  openSheet('Notiz', `<div class="wrap">
    <div class="forrow" id="nfor" style="justify-content:flex-start;margin-top:0"><span class="lbl">für</span>${st.persons.map(p => `<button class="chip glass ${st.lastFor.includes(p.id) ? 'on' : ''}" data-p="${p.id}">${h(p.self ? (st.userName || 'Mich') : p.name)}</button>`).join('')}</div>
    <textarea class="note" id="ntext" placeholder="Was soll festgehalten werden? Ein Gedanke, ein Arzttermin, ein neues Wort …"></textarea>
    <div class="controls"><button class="btn primary" id="nsave">${icon('check')} Festhalten</button></div></div>`);
  const sel = new Set(st.lastFor);
  $$('#nfor .chip').forEach(b => b.onclick = () => { const id = b.dataset.p; sel.has(id) ? sel.delete(id) : sel.add(id); if (!sel.size) sel.add(id); $$('#nfor .chip').forEach(c => c.classList.toggle('on', sel.has(c.dataset.p))); });
  setTimeout(() => $('#ntext').focus(), 450);
  $('#nsave').onclick = async () => {
    const text = $('#ntext').value.trim(); if (!text) return;
    const segs = text.split(/\n+/).map((t, i) => ({ id: 's' + (i + 1), t: 0, text: t.trim(), speaker: 'notiz' })).filter(x => x.text);
    const entry = { id: uid(), kind: 'notiz', createdAt: Date.now(), durationMs: 0, mode: 'notiz', personIds: [...sel], segments: segs, hasAudio: false };
    const ctx = { segments: segs, settings: S.settings, persons: entry.personIds.map(id => S.settings.persons.find(p => p.id === id)), createdAt: entry.createdAt };
    const out = composeLocal(ctx);
    out.versions = out.versions.map(v => ({ for: v.for, paragraphs: segs.map(s => ({ text: s.text, sources: [s.id] })) }));
    out.title = segs[0].text.split(/\s+/).slice(0, 6).join(' ') + (segs[0].text.split(/\s+/).length > 6 ? ' …' : '');
    Object.assign(entry, out);
    await store.saveEntry(S.key, entry); S.entries.unshift(entry); closeSheet(); toast('Festgehalten.');
    if (S.tab === 'chronik') renderChronik();
  };
}

/* ---------- Chronik ---------- */
function entrySnippet(e) {
  const v = (e.versions || [])[0]; const t = v ? v.paragraphs.filter(p => !p.question).map(p => p.text).join(' ') : '';
  return t || e.note || '';
}
function renderChronik() {
  const v = $('#v-chronik'); const st = S.settings;
  const filters = [['alle', 'Alle'], ...st.persons.map(p => [p.id, p.self ? (st.userName || 'Ich') : p.name]), ['obs', 'Beobachtungen']];
  let html = `<div class="wrap"><h1 class="h">Chronik</h1><div class="filters">${filters.map(([k, l]) => `<button class="chip glass ${S.filter === k ? 'on' : ''}" data-f="${k}">${h(l)}</button>`).join('')}</div>`;
  if (S.filter === 'obs') html += observationsHTML();
  else {
    const list = S.entries.filter(e => S.filter === 'alle' || (e.personIds || []).includes(S.filter));
    if (!list.length) html += `<div class="empty">Noch keine Spuren.<br>Tippe auf „Erzählen“ und fang einfach an.</div>`;
    let month = '';
    list.forEach(e => {
      const m = fmtDate(e.createdAt, { month: 'long', year: 'numeric' });
      if (m !== month) { month = m; html += `<div class="month">${m}</div>`; }
      const obs = (e.observations || []).length;
      html += `<button class="card glass" data-id="${e.id}">
        <div class="meta">${fmtDate(e.createdAt, { weekday: 'short', day: 'numeric', month: 'short' })}<i class="dot"></i>${new Date(e.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}${e.durationMs ? `<i class="dot"></i>${fmtTime(e.durationMs)}` : ''}${e.kind === 'notiz' ? '<i class="dot"></i>Notiz' : ''}</div>
        <h3>${h(e.title || 'Ohne Titel')}</h3><p>${h(entrySnippet(e))}</p>
        <div class="tags">${(e.personIds || []).map(id => `<span class="tag">${h(id === 'me' ? (st.userName || 'Ich') : personName(id))}</span>`).join('')}${obs ? `<span class="tag obs">${obs} Beobachtung${obs > 1 ? 'en' : ''}</span>` : ''}</div></button>`;
    });
  }
  v.innerHTML = html + '</div>';
  $$('.filters .chip', v).forEach(b => b.onclick = () => { S.filter = b.dataset.f; renderChronik(); });
  $$('.card', v).forEach(b => b.onclick = () => openEntry(b.dataset.id));
  const ex = $('#obsexport', v); if (ex) ex.onclick = exportObservations;
  $$('.obs-row', v).forEach(b => b.onclick = () => openEntry(b.dataset.id));
}

function allObservations() {
  const out = [];
  S.entries.forEach(e => (e.observations || []).forEach(o => {
    const seg = (e.segments || []).find(s => s.id === o.segment);
    out.push({ ...o, at: e.createdAt + (seg ? seg.t : 0), entryId: e.id, personIds: e.personIds, quote: seg ? seg.text : '' });
  }));
  return out.sort((a, b) => b.at - a.at);
}
function observationsHTML() {
  const list = allObservations();
  let html = `<div class="disclaimer">Ein beschreibendes Protokoll, keine Deutung und keine Diagnose. Hilfreich, um in einem Gespräch, etwa mit einer Ärztin, konkrete Situationen wiederzufinden.</div>`;
  if (!list.length) return html + `<div class="empty">Noch keine Beobachtungen.</div>`;
  html += `<div style="margin-bottom:14px"><button class="btn glass pill small" id="obsexport">${icon('share')} Als Protokoll teilen</button></div>`;
  list.forEach(o => {
    const d = new Date(o.at);
    html += `<button class="obs-row glass" data-id="${o.entryId}"><div class="d"><b>${d.getDate()}</b><small>${d.toLocaleDateString('de-DE', { month: 'short' })}</small></div>
      <div class="c"><small>${h(CATEGORY_LABELS[o.category] || o.category)} · ${h(o.personIds.map(id => id === 'me' ? (S.settings.userName || 'Ich') : personName(id)).join(', '))}</small>${h(o.description)}</div></button>`;
  });
  return html;
}
async function exportObservations() {
  const list = allObservations().reverse();
  const text = 'Beobachtungsprotokoll (aus Spur)\nBeschreibend, ohne Deutung.\n\n' + list.map(o =>
    `${new Date(o.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${CATEGORY_LABELS[o.category]} · ${o.personIds.map(id => id === 'me' ? (S.settings.userName || 'Ich') : personName(id)).join(', ')}\n${o.description}${o.quote && o.quote !== o.description ? `\nWörtlich: „${o.quote}“` : ''}`).join('\n\n');
  if (navigator.share) { try { await navigator.share({ title: 'Beobachtungsprotokoll', text }); return; } catch { return; } }
  try { await navigator.clipboard.writeText(text); toast('Protokoll kopiert.'); } catch { toast('Teilen nicht möglich.'); }
}

/* ---------- Eintrag ---------- */
let audioEl = null, audioURL = null;
function openEntry(id) {
  const e = S.entries.find(x => x.id === id); if (!e) return;
  let tab = 'erzaehlung', ver = 0;
  const st = S.settings;
  const segMap = Object.fromEntries((e.segments || []).map(s => [s.id, s]));
  function body() {
    const versions = e.versions || [];
    const v = versions[ver] || versions[0] || { paragraphs: [] };
    let html = `<div class="wrap"><div class="entry-date">${fmtDate(e.createdAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${new Date(e.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
      <h2 class="entry-title" id="etitle">${h(e.title || 'Ohne Titel')}</h2>
      <div class="badge">${e.composer && e.composer !== 'lokal' ? icon('spark') + ' erzählt mit KI' : 'lokal geordnet'}${e.durationMs ? ' · ' + fmtTime(e.durationMs) : ''}</div>
      ${e.hasAudio ? `<div class="player glass pill" id="player"><button class="pp" id="pp" aria-label="Abspielen">${icon('play')}</button><div class="track"><i id="prog"></i></div><small id="ptime">${fmtTime(e.durationMs)}</small></div>` : '<div style="height:18px"></div>'}
      <div class="seg glass pill small" id="etabs">${[['erzaehlung', 'Erzählung'], ['original', 'Original'], ['obs', 'Beobachtungen']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    if (versions.length > 1 && tab === 'erzaehlung') html += `<div class="forrow" style="justify-content:flex-start"><span class="lbl">Version für</span>${versions.map((x, i) => `<button class="chip glass ${i === ver ? 'on' : ''}" data-v="${i}">${h(x.for === 'me' ? (st.userName || 'Mich') : personName(x.for))}</button>`).join('')}</div>`;
    html += '<div style="height:16px"></div>';
    if (tab === 'erzaehlung') {
      if (e.note) html += `<p class="disclaimer">${h(e.note)}</p>`;
      html += `<div class="prose">${v.paragraphs.map((p, i) => `<p data-i="${i}" class="${p.question ? 'q' : ''}">${h(p.text)}</p>`).join('')}</div>`;
      if (v.paragraphs.length) html += `<div class="hint" style="margin:0">Tippe auf einen Absatz, um zu sehen, was wirklich gesagt wurde.</div>`;
      if ((e.topics || []).length) html += `<div class="tags" style="margin-top:16px">${e.topics.map(t => `<span class="tag">${h(t)}</span>`).join('')}</div>`;
    } else if (tab === 'original') {
      html += `<div class="raw">${(e.segments || []).map(s => `<div><time>${s.t ? fmtTime(s.t) : ''}</time><span class="${s.speaker === 'frage' ? 'q' : ''}">${h(s.text)}</span></div>`).join('') || '<p class="disclaimer">Kein Transkript vorhanden.</p>'}</div>`;
      if (e.hasAudio && st.ai.provider === 'mistral') html += `<div class="actions" style="border:0;margin-top:10px"><button class="btn glass pill small" id="retrans">${icon('mic')} Neu verschriftlichen (Mistral)</button></div>`;
    } else {
      const obs = e.observations || [];
      html += `<div class="disclaimer">Beschreibend, ohne Deutung.</div>` + (obs.length ? obs.map(o => {
        const s = segMap[o.segment];
        return `<div class="obs-row glass"><div class="d"><b>${s && s.t ? fmtTime(s.t) : '·'}</b><small>${s && s.t ? 'min' : ''}</small></div><div class="c"><small>${h(CATEGORY_LABELS[o.category] || o.category)}</small>${h(o.description)}</div></div>`;
      }).join('') : '<div class="empty" style="padding:30px">Keine Beobachtungen in diesem Eintrag.</div>');
    }
    html += `<div class="actions">
      <button class="btn glass pill small" id="recompose">${icon('spark')} Neu erzählen</button>
      <button class="btn glass pill small" id="rename">${icon('pen')} Titel</button>
      <button class="btn glass pill small" id="eshare">${icon('share')} Teilen</button>
      <button class="btn glass pill small danger" id="edel">${icon('trash')} Löschen</button></div></div>`;
    return html;
  }
  function wire() {
    const sh = $('.sheet .body');
    $$('#etabs button', sh).forEach(b => b.onclick = () => { tab = b.dataset.t; refresh(); });
    $$('[data-v]', sh).forEach(b => b.onclick = () => { ver = +b.dataset.v; refresh(); });
    $$('.prose p', sh).forEach(p => p.onclick = () => {
      const next = p.nextElementSibling;
      if (next && next.classList.contains('source')) { next.remove(); p.classList.remove('src-on'); return; }
      const v = (e.versions || [])[ver] || e.versions[0]; const para = v.paragraphs[+p.dataset.i];
      const src = (para.sources || []).map(id => segMap[id]).filter(Boolean);
      if (!src.length) return;
      p.classList.add('src-on');
      p.insertAdjacentHTML('afterend', `<div class="source">${src.map(s => `<span><time>${s.t ? fmtTime(s.t) : ''}</time>${h(s.text)}</span>`).join('')}</div>`);
      if (audioEl && src[0].t) { audioEl.currentTime = Math.max(0, src[0].t / 1000 - 0.5); }
    });
    if (e.hasAudio) wirePlayer(e);
    $('#recompose').onclick = async () => {
      const b = $('#recompose'); b.innerHTML = icon('spark') + ' Erzählt neu …'; b.disabled = true;
      await compose(e); await store.saveEntry(S.key, e); refresh(); toast('Neu erzählt, im aktuellen Ton.');
    };
    $('#rename').onclick = () => {
      const t = $('#etitle'); t.contentEditable = 'true'; t.focus();
      document.getSelection().selectAllChildren(t);
      const done = async () => { t.contentEditable = 'false'; e.title = t.textContent.trim() || e.title; await store.saveEntry(S.key, e); };
      t.onblur = done; t.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); t.blur(); } };
    };
    $('#eshare').onclick = async () => {
      const v = (e.versions || [])[ver] || { paragraphs: [] };
      const text = `${e.title}\n${fmtDate(e.createdAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n\n${v.paragraphs.map(p => p.text).join('\n\n')}`;
      if (navigator.share) { try { await navigator.share({ title: e.title, text }); } catch { } }
      else { await navigator.clipboard.writeText(text); toast('Kopiert.'); }
    };
    $('#edel').onclick = async () => {
      if (!confirm('Diesen Eintrag und die Aufnahme endgültig löschen?')) return;
      await store.deleteEntry(e.id); S.entries = S.entries.filter(x => x.id !== e.id); closeSheet();
      if (S.tab === 'chronik') renderChronik(); toast('Gelöscht.');
    };
    const rt = $('#retrans'); if (rt) rt.onclick = async () => {
      rt.textContent = 'Verschriftliche …'; rt.disabled = true;
      try { const blob = await store.loadAudio(S.key, e.id); e.segments = await transcribeRemote(st, blob); await compose(e); await store.saveEntry(S.key, e); tab = 'erzaehlung'; refresh(); }
      catch (err) { toast(err.message); rt.textContent = 'Erneut versuchen'; rt.disabled = false; }
    };
  }
  function refresh() { const pos = $('.sheet .body').scrollTop; $('.sheet .body').innerHTML = body(); wire(); $('.sheet .body').scrollTop = pos; }
  openSheet('', body(), () => { if (audioEl) { audioEl.pause(); } if (audioURL) URL.revokeObjectURL(audioURL); audioEl = null; audioURL = null; if (S.tab === 'chronik') renderChronik(); });
  wire();
}

async function wirePlayer(e) {
  const pp = $('#pp'); if (!pp) return;
  if (!audioEl) {
    const blob = await store.loadAudio(S.key, e.id); if (!blob) return;
    audioURL = URL.createObjectURL(blob); audioEl = new Audio(audioURL); audioEl.preload = 'metadata';
  }
  const prog = $('#prog'), pt = $('#ptime');
  const upd = () => { const d = (audioEl.duration && isFinite(audioEl.duration)) ? audioEl.duration : e.durationMs / 1000; if (prog) prog.style.width = (audioEl.currentTime / d * 100) + '%'; if (pt) pt.textContent = fmtTime((d - audioEl.currentTime) * 1000); };
  audioEl.ontimeupdate = upd; audioEl.onended = () => { pp.innerHTML = icon('play'); };
  pp.innerHTML = icon(audioEl.paused ? 'play' : 'pause');
  pp.onclick = () => { if (audioEl.paused) { audioEl.play(); pp.innerHTML = icon('pause'); } else { audioEl.pause(); pp.innerHTML = icon('play'); } };
  upd();
}

/* ---------- Suche ---------- */
function renderSearch() {
  const v = $('#v-suche');
  if (!$('#q', v)) {
    v.innerHTML = `<div class="wrap"><h1 class="h">Suche</h1><label class="searchbox glass pill">${icon('search')}<input id="q" type="search" placeholder="Wort, Name, Gefühl …" autocomplete="off" enterkeyhint="search"></label><div id="results"></div></div>`;
    $('#q', v).oninput = () => runSearch($('#q', v).value);
  }
  runSearch($('#q', v).value);
}
function runSearch(q) {
  const out = $('#results'); q = q.trim().toLowerCase();
  if (!q) { out.innerHTML = `<div class="empty">Alles bleibt auf deinem Gerät.<br>Auch die Suche.</div>`; return; }
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const hits = [];
  S.entries.forEach(e => {
    const texts = [e.title || '', ...(e.versions || []).flatMap(v => v.paragraphs.map(p => p.text)), ...(e.segments || []).map(s => s.text), ...(e.topics || [])];
    const found = texts.find(t => t.toLowerCase().includes(q));
    if (found) hits.push({ e, found });
  });
  if (!hits.length) { out.innerHTML = `<div class="empty">Nichts gefunden.</div>`; return; }
  out.innerHTML = hits.map(({ e, found }) => {
    const i = found.toLowerCase().indexOf(q); const start = Math.max(0, i - 50);
    const snip = (start ? '… ' : '') + found.slice(start, i + q.length + 90);
    return `<button class="card glass" data-id="${e.id}"><div class="meta">${fmtDate(e.createdAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div><h3>${h(e.title)}</h3><p>${h(snip).replace(re, m => `<mark>${m}</mark>`)}</p></button>`;
  }).join('');
  $$('.card', out).forEach(b => b.onclick = () => openEntry(b.dataset.id));
}

/* ---------- Blatt ---------- */
let sheetClose = null;
function openSheet(title, html, onClose) {
  closeSheet(true);
  const el = document.createElement('div'); el.className = 'sheet'; el.setAttribute('role', 'dialog');
  el.innerHTML = `<div class="bar"><button class="iconbtn glass" id="sclose" aria-label="Schließen">${icon('back')}</button><div class="t">${h(title)}</div><div style="width:44px"></div></div><div class="body">${html}</div>`;
  document.body.appendChild(el); document.body.classList.add('sheet-open');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  $('#sclose', el).onclick = () => closeSheet();
  sheetClose = onClose || null;
  // Wischen nach rechts vom Rand schließt
  let x0 = null; el.addEventListener('touchstart', ev => { const t = ev.touches[0]; x0 = t.clientX < 28 ? t.clientX : null; }, { passive: true });
  el.addEventListener('touchend', ev => { if (x0 !== null && ev.changedTouches[0].clientX - x0 > 90) closeSheet(); x0 = null; });
}
function closeSheet(instant) {
  const el = $('.sheet'); if (!el) return;
  const cb = sheetClose; sheetClose = null; cb && cb();
  document.body.classList.remove('sheet-open');
  if (instant) { el.remove(); return; }
  el.classList.remove('on'); setTimeout(() => el.remove(), 500);
}

/* ---------- Einstellungen ---------- */
const TONE_EXAMPLES = [
  [0, 'Abends gespielt. Turm aus Bauklötzen gebaut, umgefallen, neu gebaut.'],
  [30, 'Am Abend haben wir einen Turm gebaut. Er fiel um, und wir haben einfach weitergebaut.'],
  [60, 'Der Abend gehörte den Bauklötzen. Dreimal stürzte der Turm, dreimal lachten wir und fingen von vorne an.'],
  [85, 'Wie Ebbe und Flut: Der Turm wuchs, fiel, wuchs wieder. Und euer Lachen war das, was stehen blieb.']
];
const toneExample = v => [...TONE_EXAMPLES].reverse().find(x => v >= x[0])[1];

function openSettings() {
  const st = S.settings;
  const sw = (k, on) => `<button class="switch ${on ? 'on' : ''}" data-sw="${k}" role="switch" aria-checked="${on}"></button>`;
  openSheet('Einstellungen', `<div class="wrap">
    <div class="group-t">Menschen</div>
    <div class="group glass" id="persons">
      <div class="row"><span class="k">Dein Name</span><input type="text" id="uname" value="${h(st.userName)}" placeholder="optional"></div>
      ${st.persons.filter(p => !p.self).map(p => `<div class="row person"><input type="text" data-pid="${p.id}" value="${h(p.name)}"><button class="iconbtn" data-del="${p.id}" aria-label="Entfernen">${icon('x')}</button></div>`).join('')}
      <div class="row"><button class="link" id="addp" style="padding:0">${icon('plus')} Person hinzufügen</button></div>
    </div>

    <div class="group-t">Erzählweise</div>
    <div class="group glass">
      <div class="slider"><div class="k" style="font-size:16px">Ton</div><input type="range" min="0" max="100" value="${st.tone}" id="tone" aria-label="Ton von sachlich bis poetisch"><div class="ends"><span>Sachlich</span><span>Poetisch</span></div></div>
      <div class="example" id="toneex">„${h(toneExample(st.tone))}“</div>
      <div class="row"><span class="k">Perspektive</span><select id="persp"><option value="ich">Ich erzähle</option><option value="brief">Brief an die Person</option><option value="dritte">Chronik (3. Person)</option></select></div>
      <div class="row"><span class="k">Geschrieben für<small>Wer liest das später?</small></span><select id="aud"><option value="selbst">Mich selbst</option><option value="spaeter">Die Person, wenn sie groß ist</option></select></div>
    </div>

    <div class="group-t">Sensible Themen</div>
    <div class="group glass">
      <div class="row"><span class="k">Gesundheit & Schlaf<small>Erzählung und Beobachtungsprotokoll</small></span>${sw('health', st.sensitive.health)}</div>
      <div class="row"><span class="k">Starke Gefühle</span>${sw('emotions', st.sensitive.emotions)}</div>
      <div class="row"><span class="k">Konflikte & Streit</span>${sw('conflicts', st.sensitive.conflicts)}</div>
      <div class="row"><span class="k">Konkrete Orte</span>${sw('places', st.sensitive.places)}</div>
      <div class="row"><span class="k">Weitere Namen schützen<small>Kita, Freunde, Familie: vor der KI ersetzt. Mit Komma trennen.</small></span><input type="text" id="extra" value="${h(st.extraNames.join(', '))}" placeholder="z. B. Lena, Frau Berg"></div>
    </div>

    <div class="group-t">Erzählen mit KI (optional)</div>
    <div class="group glass">
      <div class="row"><span class="k">Anbieter<small>Ohne KI ordnet Spur lokal. Mit KI entsteht eine echte Erzählung.</small></span><select id="prov"><option value="none">Keine KI</option><option value="mistral">Mistral (EU)</option><option value="anthropic">Claude (Anthropic)</option></select></div>
      <div class="row" id="keyrow"><span class="k">API-Schlüssel<small>Verschlüsselt gespeichert, geht nur an den Anbieter.</small></span><input type="password" id="akey" value="${h(st.ai.key)}" placeholder="einfügen" autocomplete="off"></div>
      <div class="row" id="modelrow"><span class="k">Modell</span><input type="text" id="amodel" value="${h(st.ai.model)}" placeholder="Standard"></div>
      <div class="row"><span class="k" style="font-size:13px;color:var(--fg3)">Vor dem Senden werden alle eingetragenen Namen durch Platzhalter ersetzt. Gesendet wird nur Text, nie die Aufnahme (außer bei „Neu verschriftlichen“).</span></div>
    </div>

    <div class="group-t">Aufnahme & Schutz</div>
    <div class="group glass">
      <div class="row"><span class="k">Stimme behalten<small>Verschlüsselte Aufnahme zum Nachhören</small></span>${sw('keepAudio', st.keepAudio)}</div>
      <div class="row"><span class="k">Automatisch sperren</span><select id="lockmin"><option value="1">nach 1 Min.</option><option value="3">nach 3 Min.</option><option value="10">nach 10 Min.</option><option value="60">nach 1 Std.</option></select></div>
      <div class="row"><span class="k" style="font-size:13px;color:var(--fg3)">Spracherkennung: ${speechSupported ? 'nutzt die Diktierfunktion deines Geräts (bei Apple teils über Apple-Server).' : 'in diesem Browser nicht verfügbar.'}</span></div>
      <div class="row"><button class="link" id="lock" style="padding:0">${icon('lock')} Jetzt sperren</button></div>
    </div>

    <div class="group-t">Daten</div>
    <div class="group glass">
      <div class="row"><button class="link" id="backup" style="padding:0">${icon('share')} Verschlüsselte Sicherung exportieren</button></div>
      <div class="row"><label class="link" style="padding:0">${icon('plus')} Sicherung wiederherstellen<input type="file" id="restore" accept=".spur,application/json" hidden></label></div>
      <div class="row"><button class="link" id="wipe" style="padding:0;color:var(--danger)">${icon('trash')} Alles löschen</button></div>
    </div>
    <p class="disclaimer" style="text-align:center">Spur · Prototyp · ${S.entries.length} Einträge · alles lokal & verschlüsselt</p>
  </div>`, () => { renderToday(); if (S.tab === 'chronik') renderChronik(); });

  const body = $('.sheet .body');
  $('#persp', body).value = st.perspective; $('#aud', body).value = st.audience; $('#prov', body).value = st.ai.provider; $('#lockmin', body).value = String(st.autoLockMin);
  const showAI = () => { const on = st.ai.provider !== 'none'; $('#keyrow').style.display = on ? '' : 'none'; $('#modelrow').style.display = on ? '' : 'none'; $('#amodel').placeholder = st.ai.provider === 'mistral' ? 'mistral-large-latest' : 'claude-sonnet-5-5'; };
  showAI();
  const persist = () => save();
  $('#uname').onchange = e => { st.userName = e.target.value.trim(); persist(); };
  $$('[data-pid]', body).forEach(i => i.onchange = () => { const p = st.persons.find(x => x.id === i.dataset.pid); p.name = i.value.trim() || p.name; persist(); });
  $$('[data-del]', body).forEach(b => b.onclick = () => {
    if (!confirm('Diese Person entfernen? Bestehende Einträge bleiben erhalten.')) return;
    st.persons = st.persons.filter(p => p.id !== b.dataset.del); st.lastFor = st.lastFor.filter(x => x !== b.dataset.del); persist(); closeSheet(true); openSettings();
  });
  $('#addp').onclick = () => { const n = prompt('Name'); if (!n || !n.trim()) return; st.persons.push({ id: uid(), name: n.trim() }); persist(); closeSheet(true); openSettings(); };
  $('#tone').oninput = e => { st.tone = +e.target.value; $('#toneex').textContent = '„' + toneExample(st.tone) + '“'; };
  $('#tone').onchange = persist;
  $('#persp').onchange = e => { st.perspective = e.target.value; persist(); };
  $('#aud').onchange = e => { st.audience = e.target.value; persist(); };
  $$('[data-sw]', body).forEach(b => b.onclick = () => {
    const k = b.dataset.sw; let on;
    if (k === 'keepAudio') { st.keepAudio = !st.keepAudio; on = st.keepAudio; } else { st.sensitive[k] = !st.sensitive[k]; on = st.sensitive[k]; }
    b.classList.toggle('on', on); b.setAttribute('aria-checked', on); persist();
  });
  $('#extra').onchange = e => { st.extraNames = e.target.value.split(',').map(x => x.trim()).filter(Boolean); persist(); };
  $('#prov').onchange = e => { st.ai.provider = e.target.value; st.ai.model = ''; $('#amodel').value = ''; showAI(); persist(); };
  $('#akey').onchange = e => { st.ai.key = e.target.value.trim(); persist(); };
  $('#amodel').onchange = e => { st.ai.model = e.target.value.trim(); persist(); };
  $('#lockmin').onchange = e => { st.autoLockMin = +e.target.value; persist(); };
  $('#lock').onclick = () => lockNow();
  $('#backup').onclick = async () => {
    const data = await store.exportBackup();
    const file = new File([data], `spur-${new Date().toISOString().slice(0, 10)}.spur`, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Spur-Sicherung' }); return; } catch { return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('#restore').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    if (!confirm('Die Sicherung ersetzt alle Daten auf diesem Gerät. Fortfahren?')) return;
    try { await store.importBackup(await f.text()); S.key = null; closeSheet(true); renderLock('Sicherung geladen. Öffne sie mit ihrem Passcode.'); }
    catch (err) { toast(err.message); }
  };
  $('#wipe').onclick = async () => {
    if (!confirm('Wirklich alle Einträge, Aufnahmen und Einstellungen löschen?')) return;
    if (!confirm('Das lässt sich nicht rückgängig machen. Sicher?')) return;
    await store.wipe(); S.key = null; S.entries = []; closeSheet(true); renderSetup(1);
  };
}

/* ---------- Start ---------- */
(async function boot() {
  if (!window.crypto || !crypto.subtle || !window.indexedDB) {
    app.innerHTML = gateShell(`${MARK}<h1>Spur</h1><p>Dieser Browser unterstützt keine sichere Verschlüsselung. Bitte Safari oder Chrome in aktueller Version nutzen.</p>`); return;
  }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { }
  (await store.isSetUp()) ? renderLock() : renderSetup(1);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { });
    navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'updated' && S.key) toast('Spur wurde aktualisiert.'); });
  }
})();

// für Tests
window.__spur = { S, signal };
