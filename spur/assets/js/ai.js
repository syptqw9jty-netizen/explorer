// Spur — aus Gesprochenem wird eine Spur.
// 1) Lokal (ohne KI): ordnet das Transkript in Absätze, findet Beobachtungen per Stichwort.
// 2) Mit KI (optional, eigener Schlüssel): Erzählung im gewählten Ton. Namen werden vorher pseudonymisiert.

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export function dayPart(d) {
  const h = d.getHours();
  return h < 5 ? 'nacht' : h < 11 ? 'morgen' : h < 14 ? 'mittag' : h < 18 ? 'nachmittag' : h < 23 ? 'abend' : 'nacht';
}
export function defaultTitle(d) { return WEEKDAYS[d.getDay()] + dayPart(d); }

const CATS = {
  gesundheit: { label: 'Gesundheit', re: /\b(fieber\w*|husten|hustet|schnupfen|krank\w*|arzt|ärztin|kinderarzt\w*|schmerz\w*|bauchweh|kopfweh|ohrenweh|halsweh|tut weh|erbroch\w*|übergeben|durchfall|ausschlag|gestürzt|hingefallen|beule|verletz\w*|medikament\w*|zahn|zähne|zahnt|allergi\w*|impf\w*|blut\w*|pflaster)\b/i, setting: 'health' },
  schlaf: { label: 'Schlaf', re: /\b(schlaf\w*|eingeschlafen|aufgewacht|wach geworden|albtr[aä]um\w*|alptr[aä]um\w*|nachts wach|müde)\b/i, setting: 'health' },
  gefuehle: { label: 'Gefühle', re: /\b(wut|wütend|traurig|weinen|geweint|weint|angst|ängstlich|frustriert|ausgerastet|geschrien|schreit|trotz\w*|glücklich|stolz)\b/i, setting: 'emotions' },
  entwicklung: { label: 'Entwicklung', re: /\b(zum ersten mal|erstes mal|neues wort|neue wörter|gelernt|kann jetzt|kann schon|alleine geschafft|allein geschafft)\b/i, setting: null },
  konflikt: { label: 'Konflikt', re: /\b(streit\w*|gestritten|gehauen|geschubst|gebissen|ärger\w*|zoff)\b/i, setting: 'conflicts' }
};
export const CATEGORY_LABELS = Object.fromEntries(Object.entries(CATS).map(([k, v]) => [k, v.label]));

const STOP = new Set('Ich Du Er Sie Es Wir Ihr Und Aber Oder Dann Da Das Der Die Den Dem Ein Eine Einen Heute Gestern Morgen Ja Nein Also Weil Wenn Wie Was Wer Wo Mama Papa Okay Ok'.split(' '));

function sentence(t) {
  t = t.trim(); if (!t) return '';
  t = t[0].toUpperCase() + t.slice(1);
  return /[.!?…]$/.test(t) ? t : t + '.';
}

const FILLER = /(^|[\s,])(äh+m*|ähm+|öhm+|hm+|mhm|naja|quasi|sozusagen|irgendwie|halt)(?=[\s,.!?]|$)/gi;
function clean(t) {
  t = ' ' + t + ' ';
  t = t.replace(FILLER, '$1').replace(/^\s*(also|ja|und|so)[,\s]+/i, ' ');
  t = t.replace(/\b(\w+)( \1\b)+/gi, '$1'); // "die die" → "die"
  return t.replace(/\s+([,.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}
const DAY_NOUN = { morgen: ['Ein', 'Morgen', 'der'], mittag: ['Ein', 'Mittag', 'der'], nachmittag: ['Ein', 'Nachmittag', 'der'], abend: ['Ein', 'Abend', 'der'], nacht: ['Eine', 'Nacht', 'die'] };
const joinNames = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1];
function quote(t) { return '„' + t.replace(/[„“"]/g, '') + '“'; }

// Wer spricht? Tonhöhe/Sprecherlabel → Person, wenn eindeutig
function resolveSpeaker(seg, ctx) {
  if (seg.speaker === 'notiz') return { kind: 'self' };
  const kids = ctx.persons.filter(p => p && !p.self);
  if (!seg.who && ctx.persons.length === 1 && kids.length === 1) return { kind: 'other', name: kids[0].name, id: kids[0].id };
  if (seg.who === 'Hohe Stimme' && kids.length === 1) return { kind: 'other', name: kids[0].name, id: kids[0].id };
  if (seg.who === 'Tiefe Stimme' || !seg.who) return ctx.mode === 'raum' && !seg.who ? { kind: 'unknown' } : { kind: 'self' };
  return { kind: 'unknown', label: seg.who };
}

// Aus Gesprochenem wird ein erzählerisch dokumentierter Eintrag — ohne KI, Wort für Wort belegbar.
function narrate(segments, ctx, target) {
  const { settings } = ctx; const tone = settings.tone ?? 40;
  const me = settings.userName || 'Ich';
  let persp = settings.perspective || 'ich';
  if (persp === 'brief' && (!target || target.self)) persp = 'ich';
  const d = new Date(ctx.createdAt), part = dayPart(d);
  const dateStr = d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
  const others = ctx.persons.filter(p => p && !p.self).map(p => p.name);
  const paras = [];
  if (tone >= 20 && ctx.mode !== 'notiz') {
    let open;
    if (persp === 'dritte') open = `${defaultTitle(d)}, ${dateStr}. ${joinNames([settings.userName || 'Der Erzähler', ...others].filter(Boolean))} ${ctx.mode === 'raum' ? 'unterhielten sich' : others.length ? 'sprachen über den Tag' : 'erzählte vom Tag'}.`;
    else if (persp === 'brief') open = `${target.name}, heute war ${WEEKDAYS[d.getDay()]}, der ${dateStr}, und wir haben am ${part === 'nacht' ? 'späten Abend' : DAY_NOUN[part][1]} über deinen Tag gesprochen.`;
    else open = `${defaultTitle(d)}, ${dateStr}.` + (others.length ? ` Ich habe mit ${joinNames(others)} über den Tag gesprochen.` : '');
    paras.push({ text: open, sources: [], frame: true });
  }
  let pendingQ = null, lastKey = null, used = {};
  const verb = (t, key) => {
    const q = /\?$/.test(t), ex = /!$/.test(t);
    const n = used[key] = (used[key] || 0) + 1;
    return q ? 'fragte' : ex ? 'rief' : n === 1 ? 'erzählte' : ['ergänzte', 'sagte', 'erzählte weiter'][n % 3];
  };
  // Segmente zu Sprecherblöcken bündeln
  const blocks = [];
  segments.forEach(s => {
    if (s.speaker === 'frage') { blocks.push({ q: s }); return; }
    const sp = resolveSpeaker(s, ctx); const key = sp.kind + (sp.name || sp.label || '');
    const last = blocks[blocks.length - 1];
    const text = clean(s.text); if (!text) return;
    if (last && !last.q && last.key === key && last.segs.length < 3) { last.segs.push(s); last.texts.push(sentence(text)); }
    else blocks.push({ key, sp, segs: [s], texts: [sentence(text)] });
  });
  for (const b of blocks) {
    if (b.q) { pendingQ = b.q; continue; }
    const body = b.texts.join(' ');
    const src = b.segs.map(x => x.id).concat(pendingQ ? [pendingQ.id] : []);
    const qPre = pendingQ ? `Auf die Frage ${quote(pendingQ.text)} ` : '';
    let text;
    if (tone < 20) {
      const who = b.sp.kind === 'self' ? me : b.sp.kind === 'other' ? b.sp.name : (b.sp.label || '');
      text = (pendingQ ? `Frage: ${pendingQ.text} ` : '') + (who && (others.length || ctx.mode === 'raum') ? `${who}: ` : '') + body;
    } else if (b.sp.kind === 'self') {
      if (persp === 'dritte') text = qPre ? `${qPre}antwortete ${me}: ${quote(body)}` : `${me} ${verb(body, b.key)}: ${quote(body)}`;
      else text = qPre ? `${qPre.trim()}: ${body}` : body;
    } else if (b.sp.kind === 'other') {
      const isTarget = persp === 'brief' && target && b.sp.id === target.id;
      if (isTarget) text = qPre ? `${qPre}hast du geantwortet: ${quote(body)}` : `Du hast erzählt: ${quote(body)}`;
      else text = qPre ? `${qPre}antwortete ${b.sp.name}: ${quote(body)}` : `${b.sp.name} ${verb(body, b.key)}: ${quote(body)}`;
    } else {
      text = qPre ? `${qPre.trim()}: ${body}` : (b.sp.label ? `${b.sp.label}: ${quote(body)}` : body);
    }
    if (lastKey === b.key && !pendingQ && paras.length && !paras[paras.length - 1].frame && paras[paras.length - 1].text.length < 420) {
      const p = paras[paras.length - 1]; p.text += ' ' + text; p.sources.push(...src);
    } else paras.push({ text, sources: src });
    lastKey = b.key; pendingQ = null;
  }
  if (pendingQ) paras.push({ text: pendingQ.text, sources: [pendingQ.id], question: true });
  if (tone >= 55 && ctx.mode !== 'notiz' && paras.length > 1) {
    const [art, noun, rel] = DAY_NOUN[part];
    paras.push({ text: tone >= 80 ? `${art} ${noun}, ${rel} leise nachklingt.` : `${art} ${noun}, ${rel} bleiben darf.`, sources: [], frame: true });
  }
  return paras;
}

export function composeLocal({ segments, settings, persons, createdAt, mode }) {
  const voice = segments.filter(s => s.speaker !== 'frage');
  const ctx = { settings, persons: persons.filter(Boolean), createdAt, mode };
  // Themen: häufigste Substantive (großgeschrieben, nicht am Satzanfang)
  const counts = {}; const names = new Set(persons.map(p => p && p.name).concat(settings.userName || []).filter(Boolean));
  voice.forEach(s => s.text.split(/\s+/).slice(1).forEach(w => {
    w = w.replace(/[^\wÄÖÜäöüß-]/g, ''); if (w.length > 3 && /^[A-ZÄÖÜ]/.test(w) && !STOP.has(w) && !names.has(w)) counts[w] = (counts[w] || 0) + 1;
  }));
  const topics = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
  const observations = [];
  voice.forEach(s => {
    for (const [cat, c] of Object.entries(CATS)) {
      if (c.setting && !settings.sensitive[c.setting]) continue;
      if (c.re.test(s.text)) { observations.push({ category: cat, segment: s.id, description: sentence(s.text) }); break; }
    }
  });
  const tgt = ctx.persons.length ? ctx.persons : [{ id: 'me', self: true }];
  return {
    title: defaultTitle(new Date(createdAt)) + (topics[0] && (settings.tone ?? 40) >= 20 ? ' · ' + topics[0] : ''),
    versions: tgt.map(p => ({ for: p.id, paragraphs: narrate(segments, ctx, p) })),
    topics, observations, composer: 'lokal'
  };
}

// Netzwerkanfragen nie endlos warten lassen
function timed(ms) { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; }

// ---------- Pseudonymisierung ----------
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function makePseudonymizer(persons, extraNames = [], userName = '') {
  const map = []; // [real, alias]
  if (userName && userName.trim().length > 1) map.push([userName.trim(), '[Erzähler]']);
  persons.forEach((p, i) => { if (p.name && p.name !== 'Ich') map.push([p.name, `[Person ${String.fromCharCode(65 + i)}]`]); });
  extraNames.filter(Boolean).forEach((n, i) => map.push([n.trim(), `[Name ${i + 1}]`]));
  const fwd = s => map.reduce((t, [real, alias]) => t.replace(new RegExp(`(?<![\\wÄÖÜäöüß])${escapeRe(real)}(?![\\wÄÖÜäöüß])`, 'gi'), alias), s);
  const back = s => map.reduce((t, [real, alias]) => t.split(alias).join(real), s);
  const aliasOf = p => (map.find(m => m[0] === p.name) || [null, p.name === 'Ich' ? 'Ich (Erzähler)' : p.name])[1];
  return { fwd, back, aliasOf };
}

function toneText(v) {
  if (v < 20) return 'sachlich und knapp, wie ein gutes Protokoll; keine Ausschmückung';
  if (v < 45) return 'klar und warm, nüchtern im Kern, mit einem leisen erzählerischen Ton';
  if (v < 70) return 'erzählerisch, mit Atmosphäre und Wärme, aber ohne Kitsch';
  if (v < 88) return 'literarisch, bildhaft und poetisch, doch immer wahrhaftig';
  return 'sehr poetisch, fast wie Prosa-Lyrik, ohne Fakten zu verändern';
}
const PERSPECTIVE = {
  ich: 'aus der Ich-Perspektive des Erzählers (des Elternteils bzw. der Person, die spricht)',
  brief: 'als Brief an die Person, für die der Eintrag ist ("Liebe/r …"), in der Du-Form',
  dritte: 'in der dritten Person, wie eine ruhige Chronik'
};
const AUDIENCE = {
  selbst: 'Leser ist der Erzähler selbst, als persönliches Tagebuch',
  spaeter: 'Leser ist die Person, für die der Eintrag ist, wenn sie später erwachsen ist; der Text soll für sie verständlich und liebevoll sein'
};

export function buildPrompt({ segments, settings, persons, mode, createdAt }) {
  const ps = makePseudonymizer(persons, settings.extraNames, settings.userName);
  const s = settings.sensitive;
  const rules = [
    'Erfinde nichts. Jede Aussage muss aus dem Transkript belegbar sein.',
    'Jeder Absatz nennt in "sources" die IDs der Transkript-Segmente, auf denen er beruht.',
    'Keine Diagnosen, keine psychologischen Deutungen, keine Bewertungen von Personen.',
    'Platzhalter wie [Person A] oder [Name 1] exakt so übernehmen, niemals Namen erfinden.',
    s.health ? 'Gesundheit, Schlaf und Körperliches dürfen vorkommen, sachlich.' : 'Lass Gesundheitliches, Krankheit und Körperliches vollständig weg.',
    s.emotions ? 'Starke Gefühle dürfen vorkommen, behutsam beschrieben.' : 'Beschreibe starke negative Gefühle nur sehr zurückhaltend.',
    s.conflicts ? 'Konflikte dürfen vorkommen, fair und ohne Schuldzuweisung.' : 'Lass Streit und Konflikte weg.',
    s.places ? 'Orte dürfen genannt werden.' : 'Nenne keine konkreten Adressen oder identifizierenden Orte; allgemein umschreiben ("auf dem Spielplatz").',
    'Andere Menschen (Kita, Freunde, Familie) nur mit Rolle oder Platzhalter, keine Details über deren Privatleben.'
  ];
  const cats = ['entwicklung'].concat(s.health ? ['gesundheit', 'schlaf'] : []).concat(s.emotions ? ['gefuehle'] : []).concat(s.conflicts ? ['konflikt'] : []);
  const system = `Du bist der Chronist von "Spur", einem privaten Sprach-Tagebuch. Aus einem gesprochenen Transkript machst du einen erzählerisch dokumentierten Tagebucheintrag: Du verwandelst das Gesagte in zusammenhängende Prosa, ordnest es chronologisch, lässt Füllwörter und Wiederholungen weg und setzt besonders schöne oder typische Aussagen (vor allem von Kindern) als wörtliche Zitate.
Ton: ${toneText(settings.tone)}.
Perspektive: ${PERSPECTIVE[settings.perspective] || PERSPECTIVE.ich}.
Publikum: ${AUDIENCE[settings.audience] || AUDIENCE.selbst}.
Sprache: Deutsch. Länge: dem Inhalt angemessen, eher kurz.
Regeln:
- ${rules.join('\n- ')}
Zusätzlich sammelst du "observations": rein beschreibende Beobachtungen (was, wann, in welcher Situation) für ein späteres Gespräch, z. B. mit einer Ärztin. Nur Kategorien: ${cats.join(', ')}. Ohne Deutung.
Antworte ausschließlich mit JSON in genau dieser Form:
{"title": "kurzer Titel (max. 6 Wörter)", "versions": [{"for": "<Platzhalter der Person>", "paragraphs": [{"text": "…", "sources": ["s1"]}]}], "topics": ["…"], "observations": [{"category": "${cats[0]}", "segment": "s3", "description": "…"}]}`;
  const forList = persons.map(p => ps.aliasOf(p)).join(', ');
  const kidsOnly = persons.filter(p => p && !p.self);
  const voiceHint = segments.some(x => x.who === 'Hohe Stimme') ? `\nHinweis: "Tiefe Stimme" ist vermutlich der Erzähler${kidsOnly.length === 1 ? `, "Hohe Stimme" vermutlich ${ps.aliasOf(kidsOnly[0])}` : ''}.` : '';
  const transcript = segments.map(x => `${x.id}${x.speaker === 'frage' ? ' (Frage der App)' : x.who ? ` (${x.who})` : ''}: ${ps.fwd(x.text)}`).join('\n');
  const user = `Datum: ${new Date(createdAt).toLocaleString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
Modus: ${mode === 'raum' ? 'Gespräch im Raum, mehrere Stimmen (Stimme 1/2 = automatisch getrennte Sprecher; ordne sie nur zu, wenn es aus dem Inhalt eindeutig ist)' : mode === 'interview' ? 'Interview, die App stellt Fragen' : 'eine Person erzählt'}
Erstelle je eine Version für: ${forList}
Transkript:${voiceHint}
${transcript}`;
  return { system, user, ps };
}

function extractJSON(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('Antwort der KI war kein JSON');
  return JSON.parse(text.slice(a, b + 1));
}

export async function callModel(settings, system, user, { json = true, maxTokens = 3000 } = {}) {
  const ai = settings.ai;
  if (ai.provider === 'mistral') {
    const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST', signal: timed(90000), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ai.key },
      body: JSON.stringify({ model: ai.model || 'mistral-large-latest', temperature: 0.5, max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
    });
    if (!r.ok) throw new Error('Mistral: ' + r.status + ' ' + (await r.text()).slice(0, 160));
    return (await r.json()).choices[0].message.content;
  }
  if (ai.provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: timed(90000),
      headers: { 'Content-Type': 'application/json', 'x-api-key': ai.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: ai.model || 'claude-sonnet-5-5', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
    });
    if (!r.ok) throw new Error('Anthropic: ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const j = await r.json(); return j.content.map(c => c.text || '').join('');
  }
  throw new Error('Keine KI eingerichtet');
}

export async function composeAI(ctx) {
  const { system, user, ps } = buildPrompt(ctx);
  const raw = await callModel(ctx.settings, system, user);
  const j = extractJSON(raw);
  const validIds = new Set(ctx.segments.map(s => s.id));
  const aliasToId = {}; ctx.persons.forEach(p => { aliasToId[ps.aliasOf(p)] = p.id; });
  const versions = (j.versions || []).map((v, i) => ({
    for: aliasToId[v.for] || (ctx.persons[i] || ctx.persons[0]).id,
    paragraphs: (v.paragraphs || []).map(p => ({ text: ps.back(String(p.text || '')), sources: (p.sources || []).filter(id => validIds.has(id)) }))
  }));
  return {
    title: ps.back(String(j.title || defaultTitle(new Date(ctx.createdAt)))),
    versions: versions.length ? versions : composeLocal(ctx).versions,
    topics: (j.topics || []).map(t => ps.back(String(t))).slice(0, 6),
    observations: (j.observations || []).filter(o => CATS[o.category]).map(o => ({ category: o.category, segment: validIds.has(o.segment) ? o.segment : null, description: ps.back(String(o.description || '')) })),
    composer: ctx.settings.ai.provider
  };
}

export async function followUpQuestion(settings, persons, recent) {
  const ps = makePseudonymizer(persons, settings.extraNames, settings.userName);
  const system = 'Du führst ein behutsames Abend-Interview für ein Tagebuch. Stelle genau EINE kurze, offene Nachfrage auf Deutsch (max. 14 Wörter), die an das Gesagte anknüpft. Keine Ratschläge, keine Deutung. Nur die Frage, ohne Anführungszeichen.';
  const out = await callModel(settings, system, recent.map(s => ps.fwd(s.text)).join('\n'), { json: false, maxTokens: 60 });
  return ps.back(out.trim().split('\n')[0].replace(/^["„»]|["“«]$/g, ''));
}

// Fallback: Transkription der Aufnahme über Mistral (Voxtral), wenn das Gerät keine Spracherkennung liefert.
export async function transcribeRemote(settings, blob, keep = []) {
  if (settings.ai.provider !== 'mistral' || !settings.ai.key) throw new Error('Genaue Verschriftlichung braucht Mistral (EU) mit Schlüssel');
  const fd = new FormData();
  fd.append('model', 'voxtral-mini-latest');
  fd.append('timestamp_granularities', 'segment');
  fd.append('diarize', 'true');
  fd.append('file', blob, 'aufnahme.' + (blob.type.includes('webm') ? 'webm' : 'm4a'));
  const r = await fetch('https://api.mistral.ai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + settings.ai.key }, body: fd, signal: timed(300000) });
  if (!r.ok) throw new Error('Verschriftlichung: ' + r.status + ' ' + (await r.text()).slice(0, 120));
  const j = await r.json();
  const speakers = {};
  const label = s => { const k = s.speaker_id ?? s.speaker ?? s.speaker_label; if (k === undefined || k === null) return null; if (!(k in speakers)) speakers[k] = 'Stimme ' + (Object.keys(speakers).length + 1); return speakers[k]; };
  const parts = (j.segments && j.segments.length ? j.segments.map(s => ({ text: s.text, t: Math.round((s.start || 0) * 1000), who: label(s) }))
    : String(j.text || '').split(/(?<=[.!?])\s+/).map((text, i) => ({ text, t: i * 4000, who: null })));
  // gleiche Stimme direkt hintereinander zusammenfassen
  const merged = [];
  parts.filter(p => p.text && p.text.trim()).forEach(p => {
    const last = merged[merged.length - 1];
    if (last && last.who === p.who && p.t - last.t < 15000 && last.text.length < 260) last.text += ' ' + p.text.trim();
    else merged.push({ t: p.t, text: p.text.trim(), who: p.who });
  });
  // Interviewfragen der App an ihrer Zeitstelle erhalten
  const all = merged.map(p => ({ ...p, speaker: 'voice' })).concat(keep.map(k => ({ ...k }))).sort((a, b) => a.t - b.t);
  return all.map((p, i) => { const o = { id: 's' + (i + 1), t: p.t, text: p.text, speaker: p.speaker }; if (p.who && Object.keys(speakers).length > 1) o.who = p.who; return o; });
}

// Interviewfragen ohne KI — ruhig, offen, für Erwachsene und für den Abend mit Kind.
export const QUESTIONS = {
  selbst: ['Was war heute ein Moment, den du nicht vergessen willst?', 'Was hat dich heute überrascht?', 'Was hat dich heute beschäftigt?', 'Wofür bist du heute dankbar?', 'Was nimmst du mit in den nächsten Tag?'],
  kind: ['Was hast du heute erlebt?', 'Was war heute richtig schön?', 'Worüber habt ihr heute gelacht?', 'War heute auch etwas doof oder schwer?', 'Worauf freust du dich morgen?']
};
