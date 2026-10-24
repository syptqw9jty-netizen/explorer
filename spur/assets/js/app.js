// Spur — ein Familienbuch, das mitschreibt.
// Erzählen: Diktat an, Telefon hinlegen, leben. Buch: was daraus wird. Wissen: was Spur über euch gelernt hat.
import * as store from './store.js';
import { Session, speak, ttsSupported, signal, isIOS } from './audio.js';
import { composeLocal, composeAI, followUpQuestion, transcribeVoxtral, writerOf, QUESTIONS, CATEGORY_LABELS, KNOWLEDGE_TYPES, MODELS, dayPart } from './ai.js';
import { createOrb } from './orb.js';
import { transcribeLocal, preload, onProgress, MODEL_SIZE, labelVoices } from './local-asr.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const I = {
  mic: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3"/>',
  book: '<path d="M12 6.5C10 5 7.5 4.5 4 4.5v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-14c-3.5 0-6 .5-8 2Z"/><path d="M12 6.5v14"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z"/><path d="M5 19 13 11"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 6.2l2.1 2.1M17.7 15.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 17.8l2.1-2.1M17.7 8.3l2.1-2.1"/>',
  back: '<path d="m15 18-6-6 6-6"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="m5 12 5 5L20 7"/>',
  play: '<path d="M7 4.5v15l12-7.5-12-7.5Z" fill="currentColor" stroke="none"/>', pause: '<path d="M8 5v14M16 5v14" stroke-width="2.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', pen: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m14 6 4 4"/>',
  spark: '<path d="M12 4v4M12 16v4M4 12h4M16 12h4"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', next: '<path d="m9 18 6-6-6-6"/>',
  print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><path d="M7 14h10v7H7z"/>', moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>'
};
const icon = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

const DEFAULTS = () => ({
  persons: [{ id: 'me', name: 'Ich', self: true }], lastFor: ['me'], mode: 'raum',
  tone: 45, perspective: 'ich', audience: 'selbst',
  sensitive: { health: true, emotions: true, conflicts: false, places: true },
  keys: { mistral: '', anthropic: '' }, writerModel: '', listen: 'auto', localQuality: 'genau',
  voiceProfile: '', autoVoice: true, autoKnowledge: true,
  keepAudio: true, restMode: true, autoLockMin: 10, userName: ''
});
function migrate(st) {
  st = Object.assign(DEFAULTS(), st || {});
  st.sensitive = Object.assign(DEFAULTS().sensitive, st.sensitive);
  st.keys = Object.assign({ mistral: '', anthropic: '' }, st.keys);
  if (st.ai && st.ai.key && !st.keys[st.ai.provider]) st.keys[st.ai.provider] = st.ai.key;
  if (st.transcriber && st.listen === 'auto') st.listen = st.transcriber;
  delete st.ai; delete st.transcriber; delete st.postTranscribe;
  return st;
}

const S = { key: null, settings: null, entries: [], knowledge: [], tab: 'heute', session: null, orb: null, filter: 'alle', query: '', hiddenAt: 0, busy: false, draft: null, queue: Promise.resolve() };

/* ---------- Grundgerüst ---------- */
document.body.dataset.daypart = dayPart(new Date());
document.body.insertAdjacentHTML('afterbegin', '<div class="ambient"><i></i><i></i><i></i></div><div class="vignette"></div><div class="grain"></div><div id="print"></div>');
const app = $('#app');

function toast(msg, ms = 3000) {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), ms);
}
async function save() { await store.saveSettings(S.key, S.settings); }
const meName = () => S.settings.userName || 'Ich';
const personName = id => id === 'me' ? meName() : ((S.settings.persons.find(p => p.id === id) || {}).name || '—');
const fmtTime = ms => { const s = Math.max(0, Math.round(ms / 1000)); const hh = Math.floor(s / 3600); return hh ? `${hh}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtDate = (ts, o) => new Date(ts).toLocaleDateString('de-DE', o);
const listenMode = () => {
  const st = S.settings, k = st.keys || {};
  if (st.listen === 'mistral') return k.mistral ? 'mistral' : 'live';
  if (st.listen === 'local' || st.listen === 'live') return st.listen;
  return k.mistral ? 'mistral' : 'live';
};

/* ---------- Einband: Einrichtung & Sperre ---------- */
const gateShell = inner => `<div class="gate">${inner}</div>`;
const MARK = `<svg class="mark" viewBox="0 0 86 86" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" style="color:var(--ink)"><ellipse cx="43" cy="43" rx="14" ry="12.5" transform="rotate(18 43 43)" stroke-width="1.6"/><ellipse cx="43" cy="43" rx="24" ry="22" transform="rotate(-12 43 43)" stroke-width="1.3" opacity=".7"/><ellipse cx="43" cy="43" rx="34" ry="31.5" transform="rotate(32 43 43)" stroke-width="1" opacity=".45"/></g><circle cx="43" cy="43" r="3" fill="var(--accent)"/></svg>`;

function renderSetup(step = 1) {
  const steps = `<div class="steps">${[1, 2, 3].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>`;
  if (step === 1) {
    app.innerHTML = gateShell(`${MARK}<h1>Spur</h1><p>Ein Buch, das mitschreibt. Ihr lebt, sprecht, lacht – Spur hört zu und erzählt daraus eure Geschichte.</p>
      <button class="btn primary" id="go">Ein neues Buch beginnen</button>
      <div class="fine">Alles wird verschlüsselt auf diesem Gerät aufbewahrt.</div>`);
    $('#go').onclick = () => renderSetup(2);
  } else if (step === 2) {
    app.innerHTML = gateShell(`${steps}<h1>Ein Schloss</h1><p>Wähle einen Passcode. Nur damit lässt sich das Buch öffnen. Er lässt sich nicht wiederherstellen.</p>
      <input class="field" id="p1" type="password" autocomplete="new-password" placeholder="Passcode, mind. 6 Zeichen">
      <input class="field" id="p2" type="password" autocomplete="new-password" placeholder="noch einmal">
      <div class="err" id="err"></div><button class="btn primary" id="go">Weiter</button>`);
    $('#p1').focus();
    const fail = m => { $('#err').textContent = m; $('.gate').classList.remove('shake'); void $('.gate').offsetWidth; $('.gate').classList.add('shake'); };
    const go = async () => {
      const a = $('#p1').value, b = $('#p2').value;
      if (a.length < 6) return fail('Mindestens 6 Zeichen.'); if (a !== b) return fail('Die beiden Eingaben stimmen nicht überein.');
      $('#go').textContent = 'Das Schloss entsteht …';
      S.key = await store.setup(a); S.settings = DEFAULTS(); S.knowledge = []; await save(); renderSetup(3);
    };
    $('#go').onclick = go; $('#p2').onkeydown = e => { if (e.key === 'Enter') go(); };
  } else {
    app.innerHTML = gateShell(`${steps}<h1>Wer schreibt mit?</h1><p>Dein Name, und die Menschen, um die es gehen soll.</p>
      <input class="field" id="me" type="text" autocomplete="given-name" placeholder="Dein Vorname">
      <input class="field" id="kid" type="text" autocomplete="off" placeholder="Kind oder Partner:in">
      <input class="field" id="kid2" type="text" autocomplete="off" placeholder="Noch jemand (optional)">
      <button class="btn primary" id="go">Das Buch aufschlagen</button>`);
    $('#go').onclick = async () => {
      S.settings.userName = $('#me').value.trim();
      [$('#kid').value, $('#kid2').value].map(v => v.trim()).filter(Boolean).forEach(n => S.settings.persons.push({ id: uid(), name: n }));
      S.settings.lastFor = S.settings.persons.map(p => p.id);
      S.knowledge = S.settings.persons.filter(p => !p.self).map(p => ({ id: uid(), type: 'person', key: p.name, value: 'gehört zur Familie', at: Date.now(), by: 'du' }));
      await save(); await store.saveKnowledge(S.key, S.knowledge); S.entries = []; renderMain();
    };
  }
}

function renderLock(msg = '') {
  stopOrb();
  app.innerHTML = gateShell(`${MARK}<h1>Spur</h1><p>${h(msg) || 'Das Buch ist verschlossen.'}</p>
    <input class="field" id="pc" type="password" autocomplete="current-password" placeholder="Passcode">
    <div class="err" id="err"></div><button class="btn primary" id="go">Aufschlagen</button>
    <button class="link fine" id="reset" style="margin-top:26px">Passcode vergessen?</button>`);
  const pc = $('#pc'); setTimeout(() => pc.focus(), 300);
  const go = async () => {
    $('#go').textContent = 'Öffne …';
    try {
      S.key = await store.unlock(pc.value);
      const d = await store.loadAll(S.key);
      S.settings = migrate(d.settings); S.entries = d.entries; S.knowledge = d.knowledge || [];
      renderMain();
    } catch (e) {
      $('#go').textContent = 'Aufschlagen'; $('#err').textContent = 'Das war nicht der richtige Passcode.'; pc.value = '';
      $('.gate').classList.remove('shake'); void $('.gate').offsetWidth; $('.gate').classList.add('shake');
    }
  };
  $('#go').onclick = go; pc.onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#reset').onclick = async () => {
    if (!confirm('Ohne Passcode lässt sich das Buch nicht öffnen. Alles löschen und neu beginnen?')) return;
    await store.wipe(); renderSetup(1);
  };
}
function lockNow() {
  if (S.session) return;
  S.key = null; S.settings = null; S.entries = []; S.knowledge = []; closeSheet(true); renderLock();
}
document.addEventListener('visibilitychange', () => {
  if (!S.key) return;
  if (document.hidden) S.hiddenAt = Date.now();
  else if (S.hiddenAt && Date.now() - S.hiddenAt > (S.settings.autoLockMin || 10) * 60000) lockNow();
});

/* ---------- Hauptansicht ---------- */
function stopOrb() { if (S.orb) { S.orb.destroy(); S.orb = null; } }
function renderMain() {
  stopOrb();
  app.innerHTML = `
    <header class="top"><div class="brand">Spur</div><button class="iconbtn glass" id="gear" aria-label="Einstellungen">${icon('gear')}</button></header>
    <section class="view" id="v-heute"></section>
    <section class="view" id="v-buch"></section>
    <section class="view" id="v-wissen"></section>
    <nav class="tabs" role="tablist">
      <button data-tab="heute">${icon('mic')}Erzählen</button>
      <button data-tab="buch">${icon('book')}Buch</button>
      <button data-tab="wissen">${icon('leaf')}Wissen</button>
    </nav>
    <div class="rest" id="rest"><div class="dot"></div><div class="t" id="restT">Spur hört zu</div><div class="s">Tippen zum Aufwecken</div></div>`;
  $('#gear').onclick = openSettings;
  $$('.tabs button').forEach(b => b.onclick = () => go(b.dataset.tab));
  $('#rest').onclick = wakeRest;
  renderToday(); go(S.tab === 'chronik' || S.tab === 'suche' ? 'buch' : S.tab);
}
function go(tab) {
  S.tab = tab;
  $$('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-selected', b.dataset.tab === tab); });
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + tab));
  if (tab === 'buch') renderBook();
  if (tab === 'wissen') renderKnowledge();
}

/* ---------- Erzählen ---------- */
const MODES = [['raum', 'Raum'], ['erzaehlen', 'Erzählen'], ['interview', 'Interview']];
const MODE_HINT = {
  raum: 'Leg das Telefon hin und lebt. Spur schreibt mit, so lange ihr wollt.',
  erzaehlen: 'Erzähl frei. Spur macht daraus eine Seite.',
  interview: 'Spur stellt Fragen, ihr antwortet. Ganz in Ruhe.'
};
function greeting() {
  const p = dayPart(new Date()); const n = S.settings.userName ? ', ' + S.settings.userName : '';
  return ({ morgen: 'Guten Morgen', mittag: 'Guten Mittag', nachmittag: 'Guten Tag', abend: 'Guten Abend', nacht: 'Gute Nacht' }[p]) + n + '.';
}
const forChips = (sel, cls = '') => S.settings.persons.map(p => `<button class="chip ${cls} ${sel.includes(p.id) ? 'on' : ''}" data-p="${p.id}">${h(p.self ? (S.settings.userName || 'Ich') : p.name)}</button>`).join('');

function renderToday() {
  const st = S.settings; const v = $('#v-heute'); if (!v) return;
  stopOrb();
  if (!st.lastFor.some(id => st.persons.find(p => p.id === id))) st.lastFor = ['me'];
  const lm = listenMode();
  v.innerHTML = `<div class="wrap today">
    <div class="date sc">${fmtDate(Date.now(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    <div class="greet" id="greet">${h(greeting())}</div>
    <div class="seg" role="radiogroup" id="modes">${MODES.map(([k, l]) => `<button data-m="${k}" class="${st.mode === k ? 'on' : ''}" role="radio" aria-checked="${st.mode === k}">${l}</button>`).join('')}</div>
    <div class="forrow" id="forrow"><span class="lbl">mit</span>${forChips(st.lastFor)}</div>
    <div class="question" id="question" aria-live="polite"></div>
    <div class="stagebox"><div class="stage"><button class="orb" id="orb" aria-label="Aufnahme starten"><div class="sphere"></div><canvas></canvas><span class="label" id="orblabel">${st.mode === 'interview' ? 'Tippen zum Beginnen' : 'Tippen, und Spur hört zu'}</span><i class="ring-hint"></i></button></div></div>
    <div class="live" id="live" aria-live="polite"></div><div class="status" id="status">${lm === 'live' && !(st.keys || {}).mistral ? 'Tipp: Mit Mistral-Schlüssel hört Spur deutlich genauer, auch Kinder.' : ''}</div>
    <div class="controls idle" id="controls"><div class="hint">${MODE_HINT[st.mode]}</div><button class="link" id="note">${icon('pen')} Etwas aufschreiben</button></div>
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

function setStatus(text, warn = false) { const el = $('#status'); if (el) { el.textContent = text; el.classList.toggle('warn', warn); } }
function showLive() {
  const live = $('#live'); if (!live || !S.draft) return;
  const voice = S.draft.segments.filter(s => s.speaker === 'voice').slice(-2);
  live.innerHTML = voice.map(s => `<span>${s.who ? `<span class="who">${h(whoName(s.who, S.draft))}</span> ` : ''}${h(s.text)}</span>`).join(' ');
}
function whoName(who, e) {
  const kids = (e.personIds || []).filter(id => id !== 'me');
  if (who === 'Tiefe Stimme' && (e.personIds || []).includes('me')) return meName();
  if (who === 'Hohe Stimme' && kids.length === 1) return personName(kids[0]);
  return who;
}

let timerH = 0, interviewH = 0, restH = 0, qIndex = 0, interviewState = null;

async function begin() {
  const st = S.settings, lm = listenMode();
  $('#live').innerHTML = ''; setStatus('');
  const draft = { id: uid(), kind: 'aufnahme', status: 'recording', createdAt: Date.now(), durationMs: 0, mode: st.mode, personIds: [...st.lastFor], segments: [], chunks: [], hasAudio: false, listen: lm };
  S.draft = draft; S.queue = Promise.resolve();
  let doneUntil = 0;
  const s = new Session({
    keepAudio: true, protectRecording: true,
    recognize: lm === 'live' || (!isIOS && st.mode !== 'raum'),
    chunkPlan: window.__chunkPlan || [45000, 150000],
    onChunk: c => onChunk(draft, c, lm).then(() => { doneUntil = Math.max(doneUntil, c.end); }),
    onInterim: t => { if (lm !== 'live') return; const live = $('#live'); if (live) { showLiveFromSession(s); if (t) live.insertAdjacentHTML('beforeend', ` <em>${h(t)}</em>`); } },
    onFinal: seg => { if (lm === 'live' && seg.speaker !== 'frage') showLiveFromSession(s); },
    onState: x => { if (lm === 'live' && x.reason) setStatus(x.reason, x.mic !== 'frei'); }
  });
  try { await s.start(); }
  catch (e) { toast('Ohne Mikrofon geht es nicht. Bitte Zugriff erlauben.'); S.draft = null; return; }
  S.session = s; document.body.classList.add('rec');
  S.orb.set('listening');
  $('#orb').setAttribute('aria-label', 'Aufnahme beenden');
  S.entries.unshift(draft); await store.saveEntry(S.key, draft);
  const label = $('#orblabel');
  timerH = setInterval(() => {
    const el = s.elapsed(); draft.durationMs = el;
    label.innerHTML = `<b>${fmtTime(el)}</b>${st.mode === 'raum' ? 'Spur hört zu' : 'Tippen zum Beenden'}`;
    const n = draft.segments.filter(x => x.speaker === 'voice').length;
    if (lm !== 'live') setStatus(n ? `Aufgeschrieben bis ${fmtTime(doneUntil)} · ${n} ${n === 1 ? 'Abschnitt' : 'Abschnitte'}` : `Hört zu · der erste Text erscheint nach etwa einer Minute`);
    const rt = $('#restT'); if (rt) rt.textContent = `Spur hört zu · ${fmtTime(el)}`;
  }, 500);
  const ctr = $('#controls'); ctr.classList.remove('idle');
  ctr.innerHTML = `<button class="btn round danger" id="discard" aria-label="Verwerfen">${icon('x')}</button>${st.mode === 'interview' ? `<button class="btn" id="nextq">Nächste Frage ${icon('next')}</button>` : ''}${st.mode === 'raum' ? `<button class="btn round" id="restbtn" aria-label="Bildschirm abdunkeln">${icon('moon')}</button>` : ''}<button class="btn primary" id="done">${icon('check')} Fertig</button>`;
  $('#done').onclick = finish; $('#discard').onclick = discard;
  const rb = $('#restbtn'); if (rb) rb.onclick = () => showRest(true);
  if (st.mode === 'interview') startInterview(s);
  if (st.mode === 'raum' && st.restMode) armRest();
}
function showLiveFromSession(s) {
  const live = $('#live'); if (!live) return;
  live.innerHTML = s.segments.filter(x => x.speaker === 'voice').slice(-2).map(x => `<span>${h(x.text)}</span>`).join(' ');
}

// Ruhemodus: nach einer Weile ohne Berührung wird der Bildschirm fast schwarz (spart Akku, stört nicht)
function armRest() { clearTimeout(restH); restH = setTimeout(() => showRest(true), 25000); }
function showRest(on) { const r = $('#rest'); if (r) r.classList.toggle('on', on); }
function wakeRest() { showRest(false); if (S.session && S.settings.mode === 'raum' && S.settings.restMode) armRest(); }
document.addEventListener('touchstart', () => { if (S.session && !$('#rest.on')) { if (S.settings.mode === 'raum' && S.settings.restMode) armRest(); } }, { passive: true });

// Ein Abschnitt der Aufnahme ist fertig: sichern, verschriftlichen, Stimmen zuordnen, Entwurf speichern.
function onChunk(draft, c, lm) {
  const job = S.queue.then(async () => {
    const audioId = draft.id + '#' + c.index;
    try { await store.saveAudio(S.key, audioId, c.blob); draft.chunks.push({ index: c.index, start: c.start, end: c.end }); draft.hasAudio = true; } catch (e) { console.warn(e); }
    if (lm === 'mistral' || lm === 'local') {
      try {
        let parts;
        if (lm === 'mistral') parts = await transcribeVoxtral(S.settings, c.blob);
        else {
          const segs = await transcribeLocal(c.blob, { quality: S.settings.localQuality || 'genau' });
          parts = segs.filter(x => x.speaker === 'voice').map(x => ({ text: x.text, t: x.t, tEnd: x.t + 3000, spk: null }));
        }
        addParts(draft, parts.map(p => ({ ...p, t: p.t + c.start, tEnd: (p.tEnd || p.t) + c.start, chunk: c.index })));
        draft.chunks[draft.chunks.length - 1].transcribed = true;
      } catch (e) { console.warn(e); setStatus('Ein Abschnitt konnte nicht verschriftlicht werden: ' + e.message, true); }
    }
    await store.saveEntry(S.key, draft);
    showLive();
  });
  S.queue = job.catch(() => { });
  return job;
}
function addParts(draft, parts) {
  // Sprecher einer Datei einheitlich behandeln; Stimmen über Tonhöhe auf alle Abschnitte hinweg zuordnen
  const voice = draft.segments.filter(s => s.speaker === 'voice').concat(parts.map(p => ({ t: p.t, tEnd: p.tEnd, text: p.text, speaker: 'voice', spk: p.spk, chunk: p.chunk })));
  const qs = draft.segments.filter(s => s.speaker === 'frage');
  assignVoices(voice, S.session ? S.session.pitchLog : []);
  const all = voice.concat(qs).sort((a, b) => a.t - b.t);
  draft.segments = all.map((s, i) => ({ ...s, id: 's' + (i + 1) }));
}
function assignVoices(segs, pitchLog) {
  if (!pitchLog || !pitchLog.length) return;
  segs.forEach(s => delete s.who);
  labelVoices(segs, pitchLog);
  // gleiche Sprecher-ID innerhalb einer Datei → Mehrheitsentscheidung
  const groups = {};
  segs.forEach(s => { if (s.spk != null && s.who) { const k = s.chunk + ':' + s.spk; (groups[k] = groups[k] || []).push(s); } });
  Object.values(groups).forEach(g => { const c = {}; g.forEach(s => c[s.who] = (c[s.who] || 0) + 1); const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; g.forEach(s => s.who = top); });
  segs.forEach(s => { delete s.f0; });
}

function questionSet() { return S.settings.lastFor.some(id => id !== 'me') ? QUESTIONS.kind : QUESTIONS.selbst; }
async function ask(s, text) {
  const q = $('#question'); if (!q) return;
  q.style.opacity = 0; await new Promise(r => setTimeout(r, 250)); q.textContent = text; q.style.opacity = 1;
  const seg = s.addSegment(text, 'frage');
  if (S.draft) { S.draft.segments.push({ ...seg, id: 'q' + uid() }); }
  if (ttsSupported) { s.pauseRecognition(); S.orb.set('speaking'); await speak(text); if (!S.session) return; S.orb.set('listening'); if (s.recognize) s.resumeRecognition(); }
  s.resetHeard();
}
async function nextQuestion(s) {
  if (interviewState === 'asking') return; interviewState = 'asking';
  const set = questionSet(); let text = null; const ai = !!writerOf(S.settings);
  if (ai && qIndex > 0 && qIndex % 2 === 1) {
    const recent = (S.draft ? S.draft.segments : s.segments).filter(x => x.speaker === 'voice').slice(-4);
    if (recent.length) { try { S.orb.set('thinking'); text = await followUpQuestion(S.settings, [], recent); } catch (e) { console.warn(e); } }
  }
  if (!text) text = set[Math.min(Math.floor(qIndex / (ai ? 2 : 1)), set.length - 1)];
  qIndex++;
  if (!S.session) return;
  await ask(s, text); interviewState = 'listening';
}
function startInterview(s) {
  qIndex = 0; interviewState = null; nextQuestion(s);
  $('#nextq').onclick = () => nextQuestion(s);
  interviewH = setInterval(() => { if (interviewState === 'listening' && s.heardSomething() && s.silenceMs() > 4500) nextQuestion(s); }, 500);
}
function endUI() {
  clearInterval(timerH); clearInterval(interviewH); clearTimeout(restH); interviewState = null; showRest(false);
  if (ttsSupported) speechSynthesis.cancel();
  document.body.classList.remove('rec');
}
async function discard() {
  if (!confirm('Diese Aufnahme verwerfen?')) return;
  const s = S.session, d = S.draft; S.session = null; endUI(); await s.stop(); await S.queue;
  if (d) { await store.deleteEntry(d.id); S.entries = S.entries.filter(x => x.id !== d.id); }
  S.draft = null; renderToday();
}

async function finish() {
  const s = S.session; if (!s) return; S.session = null; S.busy = true; endUI();
  const draft = S.draft, lm = draft.listen;
  S.orb.set('thinking');
  $('#orblabel').innerHTML = lm === 'live' ? 'Wird zur Seite …' : 'Die letzten Minuten werden aufgeschrieben …';
  $('#controls').innerHTML = ''; $('#question').textContent = '';
  const res = await s.stop(); await S.queue;
  draft.durationMs = res.durationMs;
  if (lm === 'live') {
    const segs = res.segments.map(x => ({ ...x }));
    assignVoices(segs.filter(x => x.speaker === 'voice'), res.pitchLog);
    draft.segments = segs.map((x, i) => ({ ...x, id: 's' + (i + 1) }));
    // nichts erkannt, aber Mistral vorhanden → nachträglich hören
    if (!segs.some(x => x.speaker === 'voice') && S.settings.keys.mistral && draft.chunks.length) await transcribeAllChunks(draft);
  } else assignVoices(draft.segments.filter(x => x.speaker === 'voice'), res.pitchLog);
  $('#orblabel').innerHTML = 'Wird zur Seite …';
  await compose(draft);
  draft.status = 'done';
  await store.saveEntry(S.key, draft);
  S.draft = null; S.busy = false; renderToday(); openEntry(draft.id);
}
async function transcribeAllChunks(e) {
  let parts = [];
  for (const c of e.chunks) {
    const blob = await store.loadAudio(S.key, e.id + '#' + c.index); if (!blob) continue;
    const p = await transcribeVoxtral(S.settings, blob);
    parts = parts.concat(p.map(x => ({ ...x, t: x.t + c.start, tEnd: x.tEnd + c.start, chunk: c.index })));
  }
  const qs = e.segments.filter(s => s.speaker === 'frage');
  e.segments = parts.map(p => ({ t: p.t, tEnd: p.tEnd, text: p.text, speaker: 'voice', spk: p.spk, chunk: p.chunk })).concat(qs).sort((a, b) => a.t - b.t).map((s, i) => ({ ...s, id: 's' + (i + 1) }));
  e.listen = 'mistral';
}

/* ---------- Aus Gesagtem wird eine Seite ---------- */
async function compose(entry) {
  const st = S.settings;
  const persons = (entry.personIds || []).map(id => st.persons.find(p => p.id === id)).filter(Boolean);
  const ctx = { segments: entry.segments, settings: st, persons: persons.length ? persons : [st.persons[0]], createdAt: entry.createdAt, mode: entry.mode, knowledge: S.knowledge };
  const hasText = entry.segments.some(x => x.speaker !== 'frage');
  let out;
  delete entry.note;
  if (!hasText) {
    out = { title: composeLocal(ctx).title, versions: ctx.persons.map(p => ({ for: p.id, paragraphs: [] })), topics: [], observations: [], composer: 'lokal' };
    entry.note = entry.hasAudio ? 'Kein Text erkannt. Die Aufnahme ist aufbewahrt und lässt sich nachhören.' : 'Kein Text erkannt.';
  } else if (writerOf(st)) {
    try {
      out = await composeAI(ctx);
      applyLearning(entry, out);
    } catch (e) { console.warn(e); toast('Schreiben gerade nicht möglich, Spur ordnet lokal.'); out = composeLocal(ctx); entry.note = 'Lokal geordnet. ' + e.message; }
  } else out = composeLocal(ctx);
  const { knowledge, corrections, voiceProfile, ...rest } = out;
  Object.assign(entry, rest, { composedAt: Date.now(), style: { tone: st.tone, perspective: st.perspective } });
}
function applyLearning(entry, out) {
  const st = S.settings;
  // Korrekturen am Transkript: Original bleibt erhalten
  (out.corrections || []).forEach(c => {
    const seg = entry.segments.find(s => s.id === c.segment);
    if (seg && seg.text.includes(c.from)) { seg.orig = seg.orig || seg.text; seg.text = seg.text.split(c.from).join(c.to); }
  });
  // Wissen zusammenführen
  if (st.autoKnowledge && out.knowledge && out.knowledge.length) {
    let added = 0;
    out.knowledge.forEach(k => {
      const ex = S.knowledge.find(x => x.type === k.type && x.key.toLowerCase() === k.key.toLowerCase());
      if (ex) { if (ex.by !== 'du' && ex.value !== k.value) { ex.value = k.value; ex.at = Date.now(); ex.from = entry.id; } }
      else { S.knowledge.push({ id: uid(), ...k, at: Date.now(), from: entry.id, by: 'spur' }); added++; }
    });
    store.saveKnowledge(S.key, S.knowledge);
    if (added) entry.learned = added;
  }
  // Erzählstimme fortschreiben
  if (st.autoVoice && out.voiceProfile && out.voiceProfile !== st.voiceProfile) { st.voiceProfile = out.voiceProfile; save(); }
}

/* ---------- Notiz ---------- */
function openNote() {
  const st = S.settings; const sel = new Set(st.lastFor);
  openSheet('Notiz', `<div class="wrap">
    <div class="forrow" id="nfor" style="justify-content:flex-start;margin-top:0"><span class="lbl">für</span>${forChips([...sel])}</div>
    <textarea class="note" id="ntext" placeholder="Ein Gedanke, ein neues Wort, ein Moment, der nicht verloren gehen soll …"></textarea>
    <div class="controls"><button class="btn primary" id="nsave">${icon('check')} Ins Buch</button></div></div>`);
  $$('#nfor .chip').forEach(b => b.onclick = () => { const id = b.dataset.p; sel.has(id) ? sel.delete(id) : sel.add(id); if (!sel.size) sel.add(id); $$('#nfor .chip').forEach(c => c.classList.toggle('on', sel.has(c.dataset.p))); });
  setTimeout(() => $('#ntext').focus(), 450);
  $('#nsave').onclick = async () => {
    const text = $('#ntext').value.trim(); if (!text) return;
    const b = $('#nsave'); b.disabled = true; b.textContent = 'Wird geschrieben …';
    const segs = text.split(/\n+/).map((t, i) => ({ id: 's' + (i + 1), t: 0, text: t.trim(), speaker: 'notiz' })).filter(x => x.text);
    const entry = { id: uid(), kind: 'notiz', status: 'done', createdAt: Date.now(), durationMs: 0, mode: 'notiz', personIds: [...sel], segments: segs, hasAudio: false };
    if (writerOf(st)) await compose(entry);
    else {
      const out = composeLocal({ segments: segs, settings: st, persons: entry.personIds.map(id => st.persons.find(p => p.id === id)), createdAt: entry.createdAt, mode: 'notiz' });
      out.versions = out.versions.map(v => ({ for: v.for, paragraphs: segs.map(s => ({ text: s.text, sources: [s.id] })) }));
      out.title = segs[0].text.split(/\s+/).slice(0, 6).join(' ') + (segs[0].text.split(/\s+/).length > 6 ? ' …' : '');
      Object.assign(entry, out);
    }
    await store.saveEntry(S.key, entry); S.entries.unshift(entry); closeSheet(); toast('Steht jetzt im Buch.');
    if (S.tab === 'buch') renderBook();
  };
}

/* ---------- Buch ---------- */
function plainText(e) {
  const v = (e.versions || [])[0]; return v ? v.paragraphs.filter(p => !p.heading && !p.question).map(p => p.text).join(' ') : '';
}
function bookList() {
  const q = S.query.trim().toLowerCase();
  return S.entries.filter(e => {
    if (S.filter === 'hl' && !(e.highlights || []).length) return false;
    if (S.filter !== 'alle' && S.filter !== 'hl' && S.filter !== 'obs' && !(e.personIds || []).includes(S.filter)) return false;
    if (!q) return true;
    const texts = [e.title, e.lead, ...(e.versions || []).flatMap(v => v.paragraphs.map(p => p.text)), ...(e.segments || []).map(s => s.text), ...(e.topics || [])];
    return texts.some(t => String(t || '').toLowerCase().includes(q));
  });
}
function renderBook() {
  const v = $('#v-buch'); const st = S.settings;
  const first = S.entries.length ? S.entries[S.entries.length - 1].createdAt : Date.now();
  const filters = [['alle', 'Alle'], ...st.persons.map(p => [p.id, p.self ? (st.userName || 'Ich') : p.name]), ['hl', 'Höhepunkte'], ['obs', 'Beobachtungen']];
  if (!$('#bq', v)) {
    v.innerHTML = `<div class="wrap"><h1 class="h">${h(st.userName ? 'Das Buch der Familie' : 'Unser Buch')}</h1>
      <p class="h-sub" id="bsub"></p>
      <label class="searchline">${icon('search')}<input id="bq" type="search" placeholder="Im Buch suchen …" autocomplete="off" enterkeyhint="search"></label>
      <div class="filters" id="bfilters"></div><div id="blist"></div></div>`;
    $('#bq', v).oninput = e => { S.query = e.target.value; drawBookList(); };
  }
  $('#bsub', v).textContent = S.entries.length ? `${S.entries.length} ${S.entries.length === 1 ? 'Seite' : 'Seiten'} · seit ${fmtDate(first, { month: 'long', year: 'numeric' })}` : 'Noch leer. Die erste Seite entsteht beim Erzählen.';
  $('#bfilters', v).innerHTML = filters.map(([k, l]) => `<button class="chip ${S.filter === k ? 'on' : ''}" data-f="${k}">${h(l)}</button>`).join('');
  $$('#bfilters .chip', v).forEach(b => b.onclick = () => { S.filter = b.dataset.f; renderBook(); });
  drawBookList();
}
function drawBookList() {
  const out = $('#blist'); if (!out) return;
  if (S.filter === 'obs') { out.innerHTML = observationsHTML(); const ex = $('#obsexport'); if (ex) ex.onclick = exportObservations; $$('.obs-row[data-id]', out).forEach(b => b.onclick = () => openEntry(b.dataset.id)); return; }
  const list = bookList();
  if (!list.length) { out.innerHTML = `<div class="empty">${S.query ? 'Dazu steht noch nichts im Buch.' : 'Noch keine Seiten.<br>Tippe auf „Erzählen“ und leg einfach los.'}</div>`; return; }
  let html = '', month = '';
  const q = S.query.trim().toLowerCase();
  list.forEach(e => {
    const m = fmtDate(e.createdAt, { month: 'long', year: 'numeric' });
    if (m !== month) { month = m; html += `<div class="chapter"><span>${h(m)}</span></div>`; }
    const hl = (e.highlights || [])[0];
    let snip = e.lead || plainText(e) || e.note || '';
    if (q) { const all = [e.lead, plainText(e), ...(e.segments || []).map(s => s.text)].join(' '); const i = all.toLowerCase().indexOf(q); if (i >= 0) snip = (i > 40 ? '… ' : '') + all.slice(Math.max(0, i - 40), i + 120); }
    const recording = e.status === 'recording';
    html += `<button class="card" data-id="${e.id}">
      <div class="meta">${fmtDate(e.createdAt, { weekday: 'long', day: 'numeric', month: 'long' })}<i class="dot"></i>${new Date(e.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}${e.durationMs ? `<i class="dot"></i>${fmtTime(e.durationMs)}` : ''}${e.kind === 'notiz' ? '<i class="dot"></i>Notiz' : ''}${recording ? '<i class="dot"></i><span class="draft">unvollständig</span>' : ''}</div>
      <h3>${h(e.title || (recording ? 'Aufnahme läuft oder wurde unterbrochen' : 'Ohne Titel'))}</h3>
      <p>${q ? h(snip).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), x => `<mark>${x}</mark>`) : h(snip)}</p>
      ${hl && !q ? `<blockquote>${h(hl.text)}</blockquote>` : ''}
      <div class="tags">${(e.personIds || []).map(id => `<span class="tag">${h(personName(id))}</span>`).join('')}${(e.observations || []).length ? `<span class="tag obs">${e.observations.length} Beobachtung${e.observations.length > 1 ? 'en' : ''}</span>` : ''}</div></button>`;
  });
  html += `<div class="ornament">❧</div><div style="text-align:center;margin-bottom:10px"><button class="btn" id="printbook">${icon('print')} Als Buch drucken</button></div>`;
  out.innerHTML = html;
  $$('.card', out).forEach(b => b.onclick = () => openEntry(b.dataset.id));
  $('#printbook').onclick = () => printBook(list);
}

function allObservations() {
  const out = [];
  S.entries.forEach(e => (e.observations || []).forEach(o => {
    const seg = (e.segments || []).find(s => s.id === o.segment);
    out.push({ ...o, at: e.createdAt + (seg ? seg.t : 0), entryId: e.id, personIds: e.personIds || [], quote: seg ? seg.text : '' });
  }));
  return out.sort((a, b) => b.at - a.at);
}
function observationsHTML() {
  const list = allObservations();
  let html = `<div class="disclaimer">Ein beschreibendes Protokoll, ohne Deutung und ohne Diagnose. Hilfreich, um in einem Gespräch, etwa mit einer Ärztin, konkrete Situationen wiederzufinden.</div>`;
  if (!list.length) return html + `<div class="empty">Noch keine Beobachtungen.</div>`;
  html += `<div style="margin-bottom:14px"><button class="btn small" id="obsexport">${icon('share')} Als Protokoll teilen</button></div>`;
  list.forEach(o => {
    const d = new Date(o.at);
    html += `<button class="obs-row" data-id="${o.entryId}"><div class="d"><b>${d.getDate()}</b><small>${d.toLocaleDateString('de-DE', { month: 'short' })}</small></div>
      <div class="c"><small>${h(CATEGORY_LABELS[o.category] || o.category)} · ${h(o.personIds.map(personName).join(', '))}</small>${h(o.description)}</div></button>`;
  });
  return html;
}
async function exportObservations() {
  const list = allObservations().reverse();
  const text = 'Beobachtungsprotokoll (aus Spur)\nBeschreibend, ohne Deutung.\n\n' + list.map(o =>
    `${new Date(o.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${CATEGORY_LABELS[o.category]} · ${o.personIds.map(personName).join(', ')}\n${o.description}${o.quote && o.quote !== o.description ? `\nWörtlich: „${o.quote}“` : ''}`).join('\n\n');
  if (navigator.share) { try { await navigator.share({ title: 'Beobachtungsprotokoll', text }); return; } catch { return; } }
  try { await navigator.clipboard.writeText(text); toast('Protokoll kopiert.'); } catch { toast('Teilen nicht möglich.'); }
}

// Druck: dieselbe Typografie wie in der App, als A5-Buch mit Titelseite und Monatskapiteln
function pageHTML(e, ver = 0, forPrint = false) {
  const v = (e.versions || [])[ver] || (e.versions || [])[0] || { paragraphs: [] };
  let firstDone = false;
  return v.paragraphs.map((p, i) => {
    if (p.heading) return `<h4>${h(p.text)}</h4>`;
    if (p.quote) return `<blockquote data-i="${i}">${h('„' + p.text + '“')}${p.who ? `<cite>${h(p.who)}</cite>` : ''}</blockquote>`;
    if (p.question) return `<p data-i="${i}" class="q">${h(p.text)}</p>`;
    const cls = !firstDone && !forPrint ? 'first' : ''; firstDone = true;
    return `<p data-i="${i}" class="${cls}">${h(p.text)}</p>`;
  }).join('');
}
function printBook(list) {
  const st = S.settings;
  const sorted = [...list].filter(e => e.status !== 'recording').sort((a, b) => a.createdAt - b.createdAt);
  if (!sorted.length) return toast('Noch keine fertigen Seiten.');
  const from = fmtDate(sorted[0].createdAt, { month: 'long', year: 'numeric' }), to = fmtDate(sorted[sorted.length - 1].createdAt, { month: 'long', year: 'numeric' });
  const names = st.persons.map(p => p.self ? st.userName : p.name).filter(Boolean);
  let html = `<section class="cover"><h1>Spur</h1><p>${h(names.join(' · '))}</p><p>${h(from === to ? from : from + ' – ' + to)}</p><div class="orn">❧</div></section>`;
  let month = '';
  sorted.forEach(e => {
    const m = fmtDate(e.createdAt, { month: 'long', year: 'numeric' });
    if (m !== month) { month = m; html += `<div class="month">Kapitel<b>${h(m)}</b></div>`; }
    html += `<article><div class="d">${fmtDate(e.createdAt, { weekday: 'long', day: 'numeric', month: 'long' })}</div><h2>${h(e.title || '')}</h2>${e.lead ? `<p class="lead">${h(e.lead)}</p>` : ''}${pageHTML(e, 0, true)}<div class="end">·</div></article>`;
  });
  $('#print').innerHTML = html;
  setTimeout(() => window.print(), 50);
}

/* ---------- Wissen ---------- */
function renderKnowledge() {
  const v = $('#v-wissen'); const st = S.settings;
  const groups = {};
  S.knowledge.forEach(k => (groups[k.type] = groups[k.type] || []).push(k));
  let html = `<div class="wrap"><h1 class="h">Wissen</h1><p class="h-sub">Was Spur über euch gelernt hat – damit die Texte stimmen und nichts falsch verstanden wird.</p>
    <div class="voice-card sheetpaper"><div class="sc">Deine Erzählstimme</div><p>${h(st.voiceProfile || 'Noch keine. Sobald du ein paar Mal erzählt hast, lernt Spur, wie du sprichst: deine Wortwahl, deine Wendungen, deinen Humor. Die Seiten klingen dann nach dir.')}</p>
    <div style="margin-top:10px"><button class="link" id="editvoice" style="padding:6px 0">${icon('pen')} Bearbeiten</button></div></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0 8px"><span class="sc">${S.knowledge.length} Einträge</span><button class="btn small" id="addk">${icon('plus')} Hinzufügen</button></div>`;
  if (!S.knowledge.length) html += `<div class="empty">Noch leer. Spur lernt beim Erzählen dazu: Namen, Orte, Kinderwörter, Rituale. Du kannst auch selbst etwas eintragen.</div>`;
  Object.entries(KNOWLEDGE_TYPES).forEach(([t, label]) => {
    const g = groups[t]; if (!g || !g.length) return;
    html += `<div class="k-group"><div class="chapter"><span>${h(label)}</span></div>${g.sort((a, b) => a.key.localeCompare(b.key, 'de')).map(k => `<button class="k-item" data-k="${k.id}"><span class="kv"><span class="kk">${h(k.key)}</span> – ${h(k.value)}</span><span class="src">${k.by === 'du' ? 'von dir' : 'gelernt'}</span></button>`).join('')}</div>`;
  });
  v.innerHTML = html + '</div>';
  $('#addk', v).onclick = () => editKnowledge(null);
  $('#editvoice', v).onclick = editVoice;
  $$('.k-item', v).forEach(b => b.onclick = () => editKnowledge(S.knowledge.find(k => k.id === b.dataset.k)));
}
function editKnowledge(k) {
  const isNew = !k; k = k || { id: uid(), type: 'wort', key: '', value: '', by: 'du' };
  openSheet(isNew ? 'Wissen hinzufügen' : 'Wissen', `<div class="wrap">
    <div class="group"><div class="row"><span class="k">Art</span><select id="kt">${Object.entries(KNOWLEDGE_TYPES).map(([t, l]) => `<option value="${t}">${l}</option>`).join('')}</select></div>
    <div class="row"><span class="k">Begriff</span><input type="text" id="kk" value="${h(k.key)}" placeholder="z. B. Wawa"></div>
    <div class="row" style="display:block"><span class="k" style="display:block;margin-bottom:8px">Was man wissen sollte</span><textarea id="kv" placeholder="z. B. Mikas Wort für Wasser">${h(k.value)}</textarea></div></div>
    <div class="controls" style="justify-content:space-between">${isNew ? '<span></span>' : `<button class="btn danger" id="kdel">${icon('trash')} Löschen</button>`}<button class="btn primary" id="ksave">${icon('check')} Speichern</button></div></div>`, () => { if (S.tab === 'wissen') renderKnowledge(); });
  $('#kt').value = k.type;
  $('#ksave').onclick = async () => {
    const key = $('#kk').value.trim(), value = $('#kv').value.trim(); if (!key || !value) return toast('Bitte Begriff und Erklärung eintragen.');
    Object.assign(k, { type: $('#kt').value, key, value, by: 'du', at: Date.now() });
    if (isNew) S.knowledge.push(k);
    await store.saveKnowledge(S.key, S.knowledge); closeSheet();
  };
  const d = $('#kdel'); if (d) d.onclick = async () => { S.knowledge = S.knowledge.filter(x => x.id !== k.id); await store.saveKnowledge(S.key, S.knowledge); closeSheet(); };
}
function editVoice() {
  const st = S.settings;
  openSheet('Erzählstimme', `<div class="wrap">
    <p class="disclaimer">So klingst du, wenn du erzählst. Spur schreibt die Seiten in dieser Stimme und lernt mit jeder Aufnahme dazu. Du kannst es jederzeit anpassen.</p>
    <div class="group"><div class="row" style="display:block"><textarea id="vp" style="min-height:200px" placeholder="z. B. Kurze Sätze, trockener Humor, sagt oft „na ja“, nennt Mika „Großer“ …">${h(st.voiceProfile)}</textarea></div>
    <div class="row"><span class="k">Automatisch weiterlernen</span><button class="switch ${st.autoVoice ? 'on' : ''}" id="av" role="switch"></button></div></div>
    <div class="controls"><button class="btn primary" id="vsave">${icon('check')} Speichern</button></div></div>`, () => { if (S.tab === 'wissen') renderKnowledge(); });
  $('#av').onclick = e => { st.autoVoice = !st.autoVoice; e.currentTarget.classList.toggle('on', st.autoVoice); };
  $('#vsave').onclick = async () => { st.voiceProfile = $('#vp').value.trim(); await save(); closeSheet(); };
}

/* ---------- Eine Seite ---------- */
let player = null;
function openEntry(id) {
  const e = S.entries.find(x => x.id === id); if (!e) return;
  let tab = 'erzaehlung', ver = 0;
  const segMap = () => Object.fromEntries((e.segments || []).map(s => [s.id, s]));
  function body() {
    const versions = e.versions || [];
    const recording = e.status === 'recording' && (!S.draft || S.draft.id !== e.id);
    let html = `<div class="wrap page"><div class="entry-date">${fmtDate(e.createdAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${new Date(e.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
      <h2 class="entry-title" id="etitle">${h(e.title || (recording ? 'Unvollständige Aufnahme' : 'Ohne Titel'))}</h2>
      ${e.lead ? `<p class="lead">${h(e.lead)}</p>` : ''}
      <div class="badge">${e.composer && e.composer !== 'lokal' ? `${icon('spark')} erzählt` : 'lokal geordnet'}${e.listen === 'mistral' ? ' · genau gehört' : e.listen === 'local' ? ' · auf dem Gerät gehört' : ''}${e.durationMs ? ' · ' + fmtTime(e.durationMs) : ''}${e.learned ? ` · ${e.learned} neue${e.learned > 1 ? '' : 's'} Wissen` : ''}</div>
      ${e.hasAudio ? `<div class="player" id="player"><button class="pp" id="pp" aria-label="Abspielen">${icon('play')}</button><div class="track"><i id="prog"></i></div><small id="ptime">${fmtTime(e.durationMs)}</small></div>` : ''}
      ${recording ? `<div class="actions" style="border:0;padding-top:6px;margin-top:10px"><button class="btn primary" id="complete">${icon('check')} Aus dem Gesicherten eine Seite machen</button></div>` : ''}
      <div class="tabline" id="etabs">${[['erzaehlung', 'Erzählung'], ['original', 'Original'], ['obs', 'Beobachtungen']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    if (versions.length > 1 && tab === 'erzaehlung') html += `<div class="forrow" style="justify-content:flex-start;margin:-4px 0 14px"><span class="lbl">Fassung für</span>${versions.map((x, i) => `<button class="chip ${i === ver ? 'on' : ''}" data-v="${i}">${h(personName(x.for))}</button>`).join('')}</div>`;
    if (tab === 'erzaehlung') {
      if (e.note) html += `<p class="disclaimer">${h(e.note)}</p>`;
      html += `<div class="prose">${pageHTML(e, ver)}</div>`;
      if (versions.length && versions[ver] && versions[ver].paragraphs.length) html += `<div class="endmark">❧</div><p class="disclaimer" style="text-align:center">Tippe auf einen Absatz, um zu sehen, was wirklich gesagt wurde.</p>`;
      if ((e.topics || []).length) html += `<div class="tags" style="justify-content:center">${e.topics.map(t => `<span class="tag">${h(t)}</span>`).join('')}</div>`;
    } else if (tab === 'original') {
      html += `<div class="raw">${(e.segments || []).map(s => `<div><time>${s.t ? fmtTime(s.t) : ''}</time><span class="${s.speaker === 'frage' ? 'q' : ''}">${s.who ? `<b class="who">${h(whoName(s.who, e))}</b>` : ''}${h(s.text)}${s.orig ? ` <em style="color:var(--ink-3)">(gehört: ${h(s.orig)})</em>` : ''}</span></div>`).join('') || '<p class="disclaimer">Kein Transkript vorhanden.</p>'}</div>`;
      if (e.hasAudio && S.settings.keys.mistral) html += `<div class="actions" style="border:0;margin-top:10px"><button class="btn small" id="retrans">${icon('mic')} Noch einmal genau hören</button></div>`;
    } else {
      const obs = e.observations || []; const sm = segMap();
      html += `<div class="disclaimer">Beschreibend, ohne Deutung.</div>` + (obs.length ? obs.map(o => { const s = sm[o.segment]; return `<div class="obs-row"><div class="d"><b>${s && s.t ? fmtTime(s.t) : '·'}</b><small>${s && s.t ? 'min' : ''}</small></div><div class="c"><small>${h(CATEGORY_LABELS[o.category] || o.category)}</small>${h(o.description)}</div></div>`; }).join('') : '<div class="empty" style="padding:30px">Keine Beobachtungen auf dieser Seite.</div>');
    }
    html += `<div class="actions">
      <button class="btn small" id="recompose">${icon('spark')} Neu erzählen</button>
      <button class="btn small" id="rename">${icon('pen')} Titel</button>
      <button class="btn small" id="eshare">${icon('share')} Teilen</button>
      <button class="btn small danger" id="edel">${icon('trash')} Löschen</button></div></div>`;
    return html;
  }
  function wire() {
    const sh = $('.sheet .body');
    $$('#etabs button', sh).forEach(b => b.onclick = () => { tab = b.dataset.t; refresh(); });
    $$('[data-v]', sh).forEach(b => b.onclick = () => { ver = +b.dataset.v; refresh(); });
    $$('.prose [data-i]', sh).forEach(p => p.onclick = () => {
      const next = p.nextElementSibling;
      if (next && next.classList.contains('source')) { next.remove(); p.classList.remove('src-on'); return; }
      const v = (e.versions || [])[ver] || e.versions[0]; const para = v.paragraphs[+p.dataset.i]; const sm = segMap();
      const src = (para.sources || []).map(id => sm[id]).filter(Boolean);
      if (!src.length) return;
      p.classList.add('src-on');
      p.insertAdjacentHTML('afterend', `<div class="source">${src.map(s => `<span><time>${s.t ? fmtTime(s.t) : ''}</time>${s.who ? `<b class="who" style="font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-right:4px">${h(whoName(s.who, e))}</b>` : ''}${h(s.text)}</span>`).join('')}</div>`);
      if (player && src[0].t != null) player.seek(src[0].t - 500);
    });
    if (e.hasAudio) wirePlayer(e);
    $('#recompose').onclick = async () => {
      const b = $('#recompose'); b.innerHTML = icon('spark') + ' Schreibt neu …'; b.disabled = true;
      await compose(e); await store.saveEntry(S.key, e); refresh(); toast('Neu erzählt, in der aktuellen Erzählweise.');
    };
    $('#rename').onclick = () => {
      const t = $('#etitle'); t.contentEditable = 'true'; t.focus(); document.getSelection().selectAllChildren(t);
      const done = async () => { t.contentEditable = 'false'; e.title = t.textContent.trim() || e.title; await store.saveEntry(S.key, e); };
      t.onblur = done; t.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); t.blur(); } };
    };
    $('#eshare').onclick = async () => {
      const v = (e.versions || [])[ver] || { paragraphs: [] };
      const text = `${e.title}\n${fmtDate(e.createdAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n\n${e.lead ? e.lead + '\n\n' : ''}${v.paragraphs.map(p => p.quote ? `„${p.text}“${p.who ? ' – ' + p.who : ''}` : p.text).join('\n\n')}`;
      if (navigator.share) { try { await navigator.share({ title: e.title, text }); } catch { } } else { await navigator.clipboard.writeText(text); toast('Kopiert.'); }
    };
    $('#edel').onclick = async () => {
      if (!confirm('Diese Seite und die Aufnahme endgültig löschen?')) return;
      await store.deleteEntry(e.id); S.entries = S.entries.filter(x => x.id !== e.id); closeSheet();
      if (S.tab === 'buch') renderBook(); toast('Gelöscht.');
    };
    const rt = $('#retrans'); if (rt) rt.onclick = async () => {
      rt.textContent = 'Hört noch einmal …'; rt.disabled = true;
      try { await transcribeAllChunksOrSingle(e); await compose(e); await store.saveEntry(S.key, e); tab = 'erzaehlung'; refresh(); }
      catch (err) { toast(err.message); rt.textContent = 'Erneut versuchen'; rt.disabled = false; }
    };
    const cp = $('#complete'); if (cp) cp.onclick = async () => {
      cp.textContent = 'Wird geschrieben …'; cp.disabled = true;
      if (!e.segments.some(s => s.speaker === 'voice') && S.settings.keys.mistral && e.chunks && e.chunks.length) { try { await transcribeAllChunks(e); } catch (err) { toast(err.message); } }
      await compose(e); e.status = 'done'; await store.saveEntry(S.key, e); refresh();
    };
  }
  function refresh() { const b = $('.sheet .body'); const pos = b.scrollTop; b.innerHTML = body(); wire(); b.scrollTop = pos; }
  openSheet('', body(), () => { if (player) { player.destroy(); player = null; } if (S.tab === 'buch') renderBook(); });
  wire();
}
async function transcribeAllChunksOrSingle(e) {
  if (e.chunks && e.chunks.length) return transcribeAllChunks(e);
  const blob = await store.loadAudio(S.key, e.id); if (!blob) throw new Error('Keine Aufnahme gefunden');
  const parts = await transcribeVoxtral(S.settings, blob);
  const qs = (e.segments || []).filter(s => s.speaker === 'frage');
  e.segments = parts.map(p => ({ t: p.t, tEnd: p.tEnd, text: p.text, speaker: 'voice', spk: p.spk, chunk: 0 })).concat(qs).sort((a, b) => a.t - b.t).map((s, i) => ({ ...s, id: 's' + (i + 1) }));
}

// Abspielen: lange Aufnahmen bestehen aus mehreren Abschnitten, sie werden nahtlos nacheinander gespielt.
function makePlayer(e, onTick) {
  const parts = e.chunks && e.chunks.length ? [...e.chunks].sort((a, b) => a.index - b.index).map(c => ({ key: e.id + '#' + c.index, start: c.start, end: c.end })) : [{ key: e.id, start: 0, end: e.durationMs }];
  const total = e.durationMs || parts[parts.length - 1].end;
  const audio = new Audio(); audio.preload = 'auto';
  let cur = -1, url = null, playing = false;
  async function load(i) {
    if (i === cur) return true;
    const blob = await store.loadAudio(S.key, parts[i].key); if (!blob) return false;
    if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(blob); audio.src = url; cur = i;
    await new Promise(r => { audio.onloadedmetadata = r; setTimeout(r, 1500); });
    return true;
  }
  audio.ontimeupdate = () => onTick((parts[cur] ? parts[cur].start : 0) + audio.currentTime * 1000, total, playing);
  audio.onended = async () => { if (cur < parts.length - 1 && await load(cur + 1)) { audio.play(); } else { playing = false; onTick(total, total, false); } };
  return {
    async toggle() { if (playing) { audio.pause(); playing = false; } else { if (cur < 0) await load(0); await audio.play(); playing = true; } onTick((parts[cur] ? parts[cur].start : 0) + audio.currentTime * 1000, total, playing); },
    async seek(ms) { ms = Math.max(0, ms); let i = parts.findIndex(p => ms >= p.start && ms < p.end); if (i < 0) i = parts.length - 1; if (await load(i)) { audio.currentTime = Math.max(0, (ms - parts[i].start) / 1000); } },
    destroy() { audio.pause(); if (url) URL.revokeObjectURL(url); }
  };
}
function wirePlayer(e) {
  const pp = $('#pp'); if (!pp) return;
  if (player) player.destroy();
  player = makePlayer(e, (pos, total, playing) => {
    const prog = $('#prog'), pt = $('#ptime');
    if (prog) prog.style.width = Math.min(100, pos / total * 100) + '%';
    if (pt) pt.textContent = fmtTime(total - pos);
    const b = $('#pp'); if (b) b.innerHTML = icon(playing ? 'pause' : 'play');
  });
  pp.onclick = () => player.toggle();
}

/* ---------- Blatt ---------- */
let sheetClose = null;
function openSheet(title, html, onClose) {
  closeSheet(true);
  const el = document.createElement('div'); el.className = 'sheet'; el.setAttribute('role', 'dialog');
  el.innerHTML = `<div class="bar"><button class="iconbtn glass" id="sclose" aria-label="Schließen">${icon('back')}</button><div class="t">${h(title)}</div><div style="width:42px"></div></div><div class="body">${html}</div>`;
  document.body.appendChild(el); document.body.classList.add('sheet-open');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  $('#sclose', el).onclick = () => closeSheet();
  sheetClose = onClose || null;
  let x0 = null; el.addEventListener('touchstart', ev => { const t = ev.touches[0]; x0 = t.clientX < 28 ? t.clientX : null; }, { passive: true });
  el.addEventListener('touchend', ev => { if (x0 !== null && ev.changedTouches[0].clientX - x0 > 90) closeSheet(); x0 = null; });
}
function closeSheet(instant) {
  const el = $('.sheet'); if (!el) return;
  const cb = sheetClose; sheetClose = null; cb && cb();
  document.body.classList.remove('sheet-open');
  if (instant) { el.remove(); return; }
  el.classList.remove('on'); setTimeout(() => el.remove(), 550);
}

/* ---------- Einstellungen ---------- */
const TONE_EXAMPLES = [
  [0, '18:40, Spielplatz. Mika rutscht zum ersten Mal allein. Danach Eis.'],
  [25, 'Am frühen Abend waren wir auf dem Spielplatz. Mika ist zum ersten Mal allein gerutscht, danach gab es Eis.'],
  [50, 'Der Spielplatz war fast leer, als Mika die große Rutsche hinaufkletterte – allein, zum ersten Mal. Unten wartete das Eis.'],
  [75, 'Oben zögerte er nur kurz. Dann ließ er los, und unten war das Lachen größer als der Sandkasten. Das Eis hatte er sich verdient.']
];
const toneExample = v => [...TONE_EXAMPLES].reverse().find(x => v >= x[0])[1];

function openSettings() {
  const st = S.settings;
  const sw = (k, on) => `<button class="switch ${on ? 'on' : ''}" data-sw="${k}" role="switch" aria-checked="${on}"></button>`;
  openSheet('Einstellungen', `<div class="wrap">
    <div class="group-t">Erzählweise</div>
    <div class="group">
      <div class="slider"><input type="range" min="0" max="100" value="${st.tone}" id="tone" aria-label="Von sachlich bis erzählerisch"><div class="ends"><span>sachlich</span><span>erzählerisch</span></div></div>
      <div class="example" id="toneex">„${h(toneExample(st.tone))}“</div>
      <div class="row"><span class="k">Perspektive</span><select id="persp"><option value="ich">Ich erzähle</option><option value="brief">Brief an die Person</option><option value="dritte">Chronik, 3. Person</option></select></div>
      <div class="row"><span class="k">Geschrieben für<small>Wer liest das später?</small></span><select id="aud"><option value="selbst">Mich selbst</option><option value="spaeter">Die Person, wenn sie groß ist</option></select></div>
      <div class="row"><span class="k">Erzählstimme lernt mit<small>Die Seiten klingen nach dir: Wortwahl, Wendungen, Humor.</small></span>${sw('autoVoice', st.autoVoice)}</div>
      <div class="row"><span class="k">Wissen lernt mit<small>Namen, Orte, Kinderwörter, Rituale – für Kontext und richtige Schreibweisen.</small></span>${sw('autoKnowledge', st.autoKnowledge)}</div>
    </div>

    <div class="group-t">Menschen</div>
    <div class="group">
      <div class="row"><span class="k">Dein Name</span><input type="text" id="uname" value="${h(st.userName)}" placeholder="optional"></div>
      ${st.persons.filter(p => !p.self).map(p => `<div class="row person"><input type="text" data-pid="${p.id}" value="${h(p.name)}"><button class="iconbtn" data-del="${p.id}" aria-label="Entfernen">${icon('x')}</button></div>`).join('')}
      <div class="row"><button class="link" id="addp" style="padding:0">${icon('plus')} Person hinzufügen</button></div>
    </div>

    <div class="group-t">Hören & Schreiben</div>
    <div class="group">
      <div class="row"><span class="k">Hören<small id="lhint"></small></span><select id="listen"><option value="auto">Automatisch</option><option value="mistral">Mistral Voxtral</option><option value="local">Auf dem Gerät</option><option value="live">Live-Diktat</option></select></div>
      <div class="row"><span class="k">Mistral-Schlüssel<small>Fürs genaue Hören: trennt Stimmen, versteht Kinder und leise Sprache. console.mistral.ai</small></span><input type="password" id="kmis" value="${h(st.keys.mistral)}" placeholder="einfügen" autocomplete="off"></div>
      <div class="row"><span class="k">Claude-Schlüssel<small>Fürs Schreiben: bestes Deutsch, lernt deine Stimme. console.anthropic.com</small></span><input type="password" id="kant" value="${h(st.keys.anthropic)}" placeholder="einfügen" autocomplete="off"></div>
      <div class="row"><span class="k">Schreib-Modell<small id="whint"></small></span><input type="text" id="wmodel" value="${h(st.writerModel)}" placeholder="${MODELS.claude}"></div>
      <div class="row" id="lqrow"><span class="k">Modell auf dem Gerät</span><select id="lq"><option value="genau">Genau (~${MODEL_SIZE.genau} MB)</option><option value="schnell">Schnell (~${MODEL_SIZE.schnell} MB)</option></select></div>
      <div class="row" id="lqload"><button class="link" id="preload" style="padding:0">${icon('plus')} Modell jetzt laden (einmalig, im WLAN)</button></div>
    </div>

    <div class="group-t">Was aufgeschrieben wird</div>
    <div class="group">
      <div class="row"><span class="k">Gesundheit & Schlaf<small>auch als Beobachtungsprotokoll</small></span>${sw('health', st.sensitive.health)}</div>
      <div class="row"><span class="k">Starke Gefühle</span>${sw('emotions', st.sensitive.emotions)}</div>
      <div class="row"><span class="k">Konflikte & Streit</span>${sw('conflicts', st.sensitive.conflicts)}</div>
    </div>

    <div class="group-t">Aufnahme & Schutz</div>
    <div class="group">
      <div class="row"><span class="k">Stimmen aufbewahren<small>Verschlüsselt, zum Nachhören und für den Druck mit QR-Code</small></span>${sw('keepAudio', st.keepAudio)}</div>
      <div class="row"><span class="k">Ruhemodus im Raum<small>Bildschirm wird nach 25 s dunkel, Spur hört weiter</small></span>${sw('restMode', st.restMode)}</div>
      <div class="row"><span class="k">Automatisch sperren</span><select id="lockmin"><option value="3">nach 3 Min.</option><option value="10">nach 10 Min.</option><option value="60">nach 1 Std.</option><option value="1440">nach 1 Tag</option></select></div>
      <div class="row"><button class="link" id="lock" style="padding:0">${icon('lock')} Jetzt zuklappen</button></div>
    </div>

    <div class="group-t">Daten</div>
    <div class="group">
      <div class="row"><button class="link" id="backup" style="padding:0">${icon('share')} Verschlüsselte Sicherung exportieren</button></div>
      <div class="row"><label class="link" style="padding:0">${icon('plus')} Sicherung wiederherstellen<input type="file" id="restore" accept=".spur,application/json" hidden></label></div>
      <div class="row"><button class="link" id="wipe" style="padding:0;color:var(--danger)">${icon('trash')} Alles löschen</button></div>
    </div>
    <p class="disclaimer" style="text-align:center">Spur · ${S.entries.length} Seiten · ${S.knowledge.length} Einträge Wissen</p>
  </div>`, () => { renderToday(); if (S.tab === 'buch') renderBook(); if (S.tab === 'wissen') renderKnowledge(); });

  const body = $('.sheet .body');
  const persist = () => save();
  $('#persp', body).value = st.perspective; $('#aud', body).value = st.audience; $('#lockmin', body).value = String(st.autoLockMin); $('#listen', body).value = st.listen; $('#lq', body).value = st.localQuality || 'genau';
  const hints = () => {
    const lm = listenMode();
    $('#lhint').textContent = { mistral: 'Jetzt: Mistral Voxtral – genau, mit Sprechertrennung. Die Aufnahme wird dafür an Mistral (EU) gesendet.', local: 'Jetzt: auf dem Gerät (Whisper) – privat, aber langsamer und weniger genau.', live: 'Jetzt: Live-Diktat des Geräts – nur nahe, deutliche Stimmen.' }[lm];
    const w = writerOf(st);
    $('#whint').textContent = w === 'anthropic' ? 'Claude schreibt die Seiten.' : w === 'mistral' ? 'Mistral schreibt die Seiten (für bestes Deutsch: Claude-Schlüssel eintragen).' : 'Ohne Schlüssel ordnet Spur lokal, ohne neu zu formulieren.';
    $('#lqrow').style.display = $('#lqload').style.display = st.listen === 'local' ? '' : 'none';
  };
  hints();
  $('#tone').oninput = e => { st.tone = +e.target.value; $('#toneex').textContent = '„' + toneExample(st.tone) + '“'; };
  $('#tone').onchange = persist;
  $('#persp').onchange = e => { st.perspective = e.target.value; persist(); };
  $('#aud').onchange = e => { st.audience = e.target.value; persist(); };
  $('#uname').onchange = e => { st.userName = e.target.value.trim(); persist(); };
  $$('[data-pid]', body).forEach(i => i.onchange = () => { const p = st.persons.find(x => x.id === i.dataset.pid); p.name = i.value.trim() || p.name; persist(); });
  $$('[data-del]', body).forEach(b => b.onclick = () => {
    if (!confirm('Diese Person entfernen? Bestehende Seiten bleiben erhalten.')) return;
    st.persons = st.persons.filter(p => p.id !== b.dataset.del); st.lastFor = st.lastFor.filter(x => x !== b.dataset.del); persist(); closeSheet(true); openSettings();
  });
  $('#addp').onclick = () => { const n = prompt('Name'); if (!n || !n.trim()) return; st.persons.push({ id: uid(), name: n.trim() }); S.knowledge.push({ id: uid(), type: 'person', key: n.trim(), value: 'gehört zur Familie', at: Date.now(), by: 'du' }); store.saveKnowledge(S.key, S.knowledge); persist(); closeSheet(true); openSettings(); };
  $('#listen').onchange = e => { st.listen = e.target.value; hints(); persist(); };
  $('#kmis').onchange = e => { st.keys.mistral = e.target.value.trim(); hints(); persist(); };
  $('#kant').onchange = e => { st.keys.anthropic = e.target.value.trim(); hints(); persist(); };
  $('#wmodel').onchange = e => { st.writerModel = e.target.value.trim(); persist(); };
  $('#lq').onchange = e => { st.localQuality = e.target.value; persist(); };
  $('#preload').onclick = async () => {
    const b = $('#preload'); b.disabled = true;
    onProgress(p => { b.textContent = p.phase === 'download' ? `Lädt … ${Math.round(p.ratio * 100)} % von ${p.mb} MB` : p.phase === 'ready' ? 'Bereit' : b.textContent; });
    try { await preload(st.localQuality || 'genau'); b.textContent = 'Modell ist geladen und offline verfügbar.'; }
    catch (err) { b.textContent = 'Laden fehlgeschlagen: ' + err.message; b.disabled = false; }
  };
  $$('[data-sw]', body).forEach(b => b.onclick = () => {
    const k = b.dataset.sw; let on;
    if (k in st.sensitive) { st.sensitive[k] = !st.sensitive[k]; on = st.sensitive[k]; } else { st[k] = !st[k]; on = st[k]; }
    b.classList.toggle('on', on); b.setAttribute('aria-checked', on); persist();
  });
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
    try { await store.importBackup(await f.text()); S.key = null; closeSheet(true); renderLock('Sicherung geladen. Öffne sie mit ihrem Passcode.'); } catch (err) { toast(err.message); }
  };
  $('#wipe').onclick = async () => {
    if (!confirm('Wirklich alle Seiten, Aufnahmen, Wissen und Einstellungen löschen?')) return;
    if (!confirm('Das lässt sich nicht rückgängig machen. Sicher?')) return;
    await store.wipe(); S.key = null; S.entries = []; S.knowledge = []; closeSheet(true); renderSetup(1);
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
window.addEventListener('afterprint', () => { const p = $('#print'); if (p) p.innerHTML = ''; });

window.__spur = { S, signal };
