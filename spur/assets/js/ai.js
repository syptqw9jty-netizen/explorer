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

// ---------- Modelle ----------
// Hören: Mistral Voxtral (Sprechertrennung, leise Stimmen, Kinder). Schreiben: Claude (bestes Deutsch, langer Kontext).
export const MODELS = { listen: 'voxtral-mini-latest', claude: 'claude-sonnet-5-5', mistral: 'mistral-large-latest' };
export function writerOf(settings) {
  const k = settings.keys || {};
  if (k.anthropic) return 'anthropic';
  if (k.mistral) return 'mistral';
  return null;
}

function extractJSON(text) {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('Antwort der KI war kein JSON');
  return JSON.parse(text.slice(a, b + 1));
}

export async function callModel(settings, system, user, { json = true, maxTokens = 3000, timeout = 120000 } = {}) {
  const w = writerOf(settings); const k = settings.keys || {};
  if (w === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: timed(timeout),
      headers: { 'Content-Type': 'application/json', 'x-api-key': k.anthropic, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: settings.writerModel || MODELS.claude, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
    });
    if (!r.ok) throw new Error('Claude: ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const j = await r.json(); return j.content.map(c => c.text || '').join('');
  }
  if (w === 'mistral') {
    const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST', signal: timed(timeout), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + k.mistral },
      body: JSON.stringify({ model: MODELS.mistral, temperature: 0.5, max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
    });
    if (!r.ok) throw new Error('Mistral: ' + r.status + ' ' + (await r.text()).slice(0, 160));
    return (await r.json()).choices[0].message.content;
  }
  throw new Error('Kein Schlüssel für das Schreiben hinterlegt');
}

// ---------- Erzählweise ----------
export function toneText(v) {
  if (v < 15) return 'Dokumentation: nüchtern, präzise, chronologisch. Kurze klare Sätze, keine Ausschmückung, keine Wertung.';
  if (v < 40) return 'Dokumentierend mit Wärme: genau und klar, aber lebendig. Kleine Details und O-Töne dürfen bleiben.';
  if (v < 65) return 'Erzählerisch-dokumentarisch: wie ein gutes Tagebuch. Szenen, Übergänge und Atmosphäre – alles aus dem Gesagten.';
  if (v < 85) return 'Erzählerisch: wie eine kleine Familiengeschichte, mit Bogen, Bildern und Rhythmus – jedes Detail belegt.';
  return 'Literarisch erzählt: dicht, bildhaft, mit eigener Sprache – aber ohne Erfundenes.';
}
const PERSPECTIVE = {
  ich: 'Ich-Perspektive des Erzählers (die Person, die das Tagebuch führt).',
  brief: 'Als Brief an die Person, für die die Version ist, in der Du-Form. Für den Erzähler selbst: Ich-Perspektive.',
  dritte: 'Dritte Person, wie eine ruhige Familienchronik.'
};
const AUDIENCE = {
  selbst: 'Der Erzähler selbst liest es als persönliches Tagebuch.',
  spaeter: 'Die Person, für die die Version ist, liest es später als Erwachsene/r. Verständlich, liebevoll, mit nötigem Kontext.'
};
export const KNOWLEDGE_TYPES = { person: 'Menschen', ort: 'Orte', wort: 'Wörter & Ausdrücke', ritual: 'Rituale & Gewohnheiten', vorliebe: 'Vorlieben', ereignis: 'Ereignisse', sonstiges: 'Sonstiges' };

function knowledgeText(kn) {
  if (!kn || !kn.length) return '(noch nichts)';
  return kn.slice(-150).map(x => `- ${KNOWLEDGE_TYPES[x.type] || x.type}: ${x.key} — ${x.value}`).join('\n');
}

export function buildPrompt({ segments, settings, persons, mode, createdAt, knowledge = [] }) {
  const s = settings.sensitive || {};
  const me = settings.userName || 'der Erzähler';
  const cats = ['entwicklung'].concat(s.health ? ['gesundheit', 'schlaf'] : []).concat(s.emotions ? ['gefuehle'] : []).concat(s.conflicts ? ['konflikt'] : []);
  const rules = [
    'Erfinde nichts. Jede Aussage muss aus dem Transkript oder dem bekannten Wissen belegbar sein. Wissen nur als Kontext nutzen, nicht nacherzählen.',
    'Jeder Absatz und jedes Zitat nennt in "sources" die Segment-IDs, auf denen es beruht.',
    'Arbeite heraus, was zählt: Neues, Bewegendes, Lustiges, Wiederkehrendes und Bedeutsames bekommt Raum (bei längeren Texten mit kurzen Zwischenüberschriften). Alltägliches und Leerlauf werden knapp zusammengefasst oder weggelassen.',
    'Typische oder besonders schöne Sätze – vor allem von Kindern – als wörtliches Zitat ("quote") mit Sprecher. Zitate behutsam glätten, Kindersprache aber erhalten.',
    'Hat die Spracherkennung offensichtlich falsch gehört (Namen, Kinderwörter, Orte laut Wissen oder Zusammenhang), korrigiere es in der Erzählung und liste es unter "corrections". Bei echter Unsicherheit nicht raten, sondern neutral formulieren.',
    'Keine Diagnosen, keine psychologischen Deutungen, keine Bewertungen von Personen.',
    s.health ? 'Gesundheit und Schlaf dürfen sachlich vorkommen.' : 'Gesundheitliches und Körperliches weglassen.',
    s.conflicts ? 'Konflikte fair und ohne Schuldzuweisung.' : 'Streit und Konflikte weglassen oder nur andeuten.',
    'Stimme: Schreibe so, dass sich der Erzähler wiedererkennt. Übernimm Wortwahl, Satzlänge, Humor und Anredeformen aus seinem Stilprofil und seinen eigenen Worten im Transkript.'
  ];
  const system = `Du bist der Chronist von "Spur", einem Familienbuch, das mitschreibt. Aus gesprochener Sprache – oft lange, ungeordnete Gespräche im Raum – machst du einen Eintrag, der sich liest wie eine Seite aus einem guten Tagebuch: dokumentiert, wahr, erzählt.
Erzählweise: ${toneText(settings.tone ?? 40)}
Perspektive: ${PERSPECTIVE[settings.perspective] || PERSPECTIVE.ich}
Leser: ${AUDIENCE[settings.audience] || AUDIENCE.selbst}
Sprache: Deutsch, neue Rechtschreibung, typografische Anführungszeichen „…“.
Regeln:
- ${rules.join('\n- ')}

Antworte ausschließlich mit JSON:
{"title":"Titel, max. 6 Wörter, konkret statt allgemein",
 "lead":"ein bis zwei Sätze, die den Kern des Eintrags fassen",
 "versions":[{"for":"<Name>","paragraphs":[{"type":"h","text":"Zwischenüberschrift"},{"type":"p","text":"…","sources":["s1","s2"]},{"type":"quote","text":"…","who":"<Name>","sources":["s3"]}]}],
 "highlights":[{"text":"der eine Moment, in einem Satz","sources":["s3"]}],
 "topics":["max. 6 Schlagworte"],
 "observations":[{"category":"${cats[0]}","segment":"s3","description":"rein beschreibend: was, wann, in welcher Situation"}],
 "knowledge":[{"type":"person|ort|wort|ritual|vorliebe|ereignis|sonstiges","key":"kurz","value":"was man wissen sollte"}],
 "corrections":[{"segment":"s5","from":"falsch gehört","to":"richtig"}],
 "voice_profile":"aktualisiertes Stilprofil"}
Hinweise: "observations" nur Kategorien ${cats.join(', ')}; für ein späteres Gespräch, etwa mit einer Ärztin. "knowledge" nur NEUE, dauerhaft nützliche Fakten, die noch nicht im Wissen stehen (oder Änderungen). "voice_profile": Stilprofil von ${me} (max. 600 Zeichen: Wortwahl, typische Wendungen, Satzlänge, Humor, Kosenamen, Dialekt). Aktualisiere es nur, wenn genug eigene Sprache von ${me} vorkommt, sonst gib das bisherige unverändert zurück.`;
  const kids = persons.filter(p => p && !p.self);
  const names = persons.map(p => p.self ? (settings.userName || 'Ich (Erzähler)') : p.name);
  const label = x => x.speaker === 'frage' ? 'Frage der App' : x.speaker === 'notiz' ? 'Notiz' : x.who ? (x.who === 'Tiefe Stimme' ? `${x.who} – vermutlich ${me}` : x.who === 'Hohe Stimme' && kids.length === 1 ? `${x.who} – vermutlich ${kids[0].name}` : x.who) : '';
  const fmt = ms => { const m = Math.floor(ms / 60000), sec = Math.floor(ms / 1000) % 60; return `${m}:${String(sec).padStart(2, '0')}`; };
  const transcript = segments.map(x => `${x.id} [${fmt(x.t || 0)}]${label(x) ? ' (' + label(x) + ')' : ''}: ${x.text}`).join('\n');
  const user = `Datum: ${new Date(createdAt).toLocaleString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
Situation: ${mode === 'raum' ? 'Telefon lag im Raum, Familie im Gespräch. Mehrere Stimmen, oft durcheinander.' : mode === 'interview' ? 'Interview: Die App hat Fragen gestellt.' : mode === 'notiz' ? 'Geschriebene Notiz.' : 'Eine Person erzählt.'}
Erzähler: ${settings.userName || 'unbekannt'}. Beteiligte: ${names.join(', ')}.
Versionen schreiben für: ${names.join(', ')}

Bekanntes Wissen über die Familie:
${knowledgeText(knowledge)}

Stilprofil des Erzählers:
${settings.voiceProfile || '(noch keins – leite es aus seinen Worten ab)'}

Transkript:
${transcript}`;
  return { system, user };
}

export async function composeAI(ctx) {
  const { system, user } = buildPrompt(ctx);
  const long = ctx.segments.length > 120;
  const raw = await callModel(ctx.settings, system, user, { maxTokens: long ? 12000 : 6000, timeout: long ? 300000 : 150000 });
  const j = extractJSON(raw);
  const validIds = new Set(ctx.segments.map(s => s.id));
  const keep = ids => (ids || []).filter(id => validIds.has(id));
  const nameToId = {}; ctx.persons.forEach(p => { nameToId[(p.self ? (ctx.settings.userName || 'Ich') : p.name).toLowerCase()] = p.id; if (p.self) nameToId['ich'] = p.id; });
  const versions = (j.versions || []).map((v, i) => ({
    for: nameToId[String(v.for || '').toLowerCase().replace(/ \(.*\)$/, '')] || (ctx.persons[i] || ctx.persons[0]).id,
    paragraphs: (v.paragraphs || []).map(p => {
      const t = String(p.text || '').trim(); if (!t) return null;
      if (p.type === 'h') return { heading: true, text: t, sources: [] };
      if (p.type === 'quote') return { quote: true, text: t.replace(/^[„"»]|[“"«]$/g, ''), who: p.who || '', sources: keep(p.sources) };
      return { text: t, sources: keep(p.sources) };
    }).filter(Boolean)
  })).filter(v => v.paragraphs.length);
  return {
    title: String(j.title || defaultTitle(new Date(ctx.createdAt))),
    lead: String(j.lead || ''),
    versions: versions.length ? versions : composeLocal(ctx).versions,
    highlights: (j.highlights || []).map(x => ({ text: String(x.text || ''), sources: keep(x.sources) })).filter(x => x.text).slice(0, 5),
    topics: (j.topics || []).map(String).slice(0, 6),
    observations: (j.observations || []).filter(o => CATS[o.category]).map(o => ({ category: o.category, segment: validIds.has(o.segment) ? o.segment : null, description: String(o.description || '') })),
    knowledge: (j.knowledge || []).filter(x => x && x.key && x.value).map(x => ({ type: KNOWLEDGE_TYPES[x.type] ? x.type : 'sonstiges', key: String(x.key).trim(), value: String(x.value).trim() })),
    corrections: (j.corrections || []).filter(c => c && validIds.has(c.segment) && c.from && c.to),
    voiceProfile: typeof j.voice_profile === 'string' ? j.voice_profile.trim().slice(0, 800) : '',
    composer: writerOf(ctx.settings)
  };
}

export async function followUpQuestion(settings, persons, recent) {
  const system = 'Du führst ein behutsames Gespräch für ein Familientagebuch. Stelle genau EINE kurze, offene Nachfrage auf Deutsch (max. 14 Wörter), die an das Gesagte anknüpft. Keine Ratschläge, keine Deutung. Nur die Frage.';
  const out = await callModel(settings, system, recent.map(s => s.text).join('\n'), { json: false, maxTokens: 60, timeout: 20000 });
  return out.trim().split('\n')[0].replace(/^["„»]|["“«]$/g, '');
}

// ---------- Hören: Voxtral ----------
// Liefert rohe Teile mit Zeit (relativ zur Datei) und Sprecher-ID der Datei.
export async function transcribeVoxtral(settings, blob) {
  const key = (settings.keys || {}).mistral;
  if (!key) throw new Error('Für genaues Hören fehlt der Mistral-Schlüssel');
  const fd = new FormData();
  fd.append('model', MODELS.listen);
  fd.append('timestamp_granularities', 'segment');
  fd.append('diarize', 'true');
  fd.append('file', blob, 'aufnahme.' + (blob.type.includes('webm') ? 'webm' : 'm4a'));
  const r = await fetch('https://api.mistral.ai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd, signal: timed(300000) });
  if (!r.ok) throw new Error('Hören (Mistral): ' + r.status + ' ' + (await r.text()).slice(0, 120));
  const j = await r.json();
  const segs = j.segments && j.segments.length ? j.segments : [{ text: j.text || '', start: 0, end: 0 }];
  return segs.map(x => ({ text: String(x.text || '').trim(), t: Math.round((x.start || 0) * 1000), tEnd: Math.round((x.end || x.start || 0) * 1000), spk: x.speaker_id ?? x.speaker ?? x.speaker_label ?? null })).filter(x => x.text);
}

// Kompatibel für ganze Aufnahmen (z. B. „Neu verschriftlichen“)
export async function transcribeRemote(settings, blob, keep = []) {
  const parts = await transcribeVoxtral(settings, blob);
  const all = parts.map(p => ({ t: p.t, text: p.text, speaker: 'voice' })).concat(keep).sort((a, b) => a.t - b.t);
  return all.map((p, i) => ({ id: 's' + (i + 1), t: p.t, text: p.text, speaker: p.speaker }));
}

// Interviewfragen ohne KI — ruhig, offen, für Erwachsene und für den Abend mit Kind.
export const QUESTIONS = {
  selbst: ['Was war heute ein Moment, den du nicht vergessen willst?', 'Was hat dich heute überrascht?', 'Was hat dich heute beschäftigt?', 'Wofür bist du heute dankbar?', 'Was nimmst du mit in den nächsten Tag?'],
  kind: ['Was hast du heute erlebt?', 'Was war heute richtig schön?', 'Worüber habt ihr heute gelacht?', 'War heute auch etwas doof oder schwer?', 'Worauf freust du dich morgen?']
};
