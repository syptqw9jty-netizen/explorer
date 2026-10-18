/**
 * Explorer – Sync-Backend als Google Apps Script (läuft in deinem Google-Konto, kostenlos).
 *
 * Einrichtung (einmalig, ~5 Minuten):
 *  1. script.google.com → „Neues Projekt“ → diesen Code in Code.gs einfügen, Projekt „Explorer Sync“ nennen.
 *  2. Links „Dienste +“ → „Drive API“ hinzufügen (Kennung: Drive, Version v3).
 *  3. Oben Funktion „setup“ wählen → Ausführen → Berechtigungen bestätigen.
 *     Im Protokoll erscheint die Zeile  KEY: …  → merken.
 *  4. „Bereitstellen“ → „Neue Bereitstellung“ → Typ „Web-App“ → Ausführen als: Ich · Zugriff: Jeder → Bereitstellen.
 *     Die Web-App-URL (…/exec) kopieren.
 *  5. In der Explorer-App: Zahnrad → Sync → URL und KEY eintragen.
 *
 * Danach: täglich 05:00 Index-Neuaufbau (Trigger), Änderungsprotokoll, Web-App liefert den Index.
 * Kurzbefehl am iPhone schickt Notizen/Erinnerungen/iCloud-Drive per POST an dieselbe URL.
 */

const FOLDER_NAME = 'Explorer-App';
const KEEP_CHANGES_DAYS = 60;

// Bereiche: Pfadpräfix (quelle:/Ordner/Ordner) → Bereich. Längste Übereinstimmung gewinnt.
const AREAS = [
  { id: 'familie', name: 'Familie', color: '#34c759', glyph: 'house' },
  { id: 'nils', name: 'Nils', color: '#007aff', glyph: 'person' },
  { id: 'julia', name: 'Julia', color: '#af52de', glyph: 'person' },
  { id: 'kinder', name: 'Kinder', color: '#ff9500', glyph: 'kids' },
  { id: 'helpbus', name: 'Helpbus', color: '#ffcc00', glyph: 'bus' },
  { id: 'gauss', name: 'GAUSS', color: '#5856d6', glyph: 'work' },
  { id: 'archiv', name: 'Archiv', color: '#8e8e93', glyph: 'box' },
  { id: 'sonstiges', name: 'Sonstiges', color: '#a2845e', glyph: 'tray' }
];
const RULES = [
  { prefix: 'drive:/Familie Neumann/01 Nils/Helpbus', area: 'helpbus' },
  { prefix: 'drive:/Familie Neumann/01 Nils/Beruf GAUSS', area: 'gauss' },
  { prefix: 'drive:/Familie Neumann/00 Gemeinsam', area: 'familie' },
  { prefix: 'drive:/Familie Neumann/01 Nils', area: 'nils' },
  { prefix: 'drive:/Familie Neumann/02 Julia', area: 'julia' },
  { prefix: 'drive:/Familie Neumann/03 Emma', area: 'kinder' },
  { prefix: 'drive:/Familie Neumann/04 Paul', area: 'kinder' },
  { prefix: 'drive:/Familie Neumann/05 Oskar', area: 'kinder' },
  { prefix: 'drive:/Familie Neumann', area: 'familie' },
  { prefix: 'drive:/Nils – Privat', area: 'nils' },
  { prefix: 'drive:/Helpbus e.V.', area: 'helpbus' },
  { prefix: 'drive:/Notizen-Archiv (iCloud, Okt 2026)', area: 'archiv' },
  { prefix: 'notes:/', area: 'nils' },
  { prefix: 'reminders:/', area: 'nils' },
  { prefix: 'icloud:/', area: 'nils' }
];
const DEFAULT_AREA = 'sonstiges';

// ---------- Einrichtung ----------
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('KEY')) props.setProperty('KEY', Utilities.getUuid().replace(/-/g, '').slice(0, 24));
  folder_();
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('buildIndex').timeBased().everyDays(1).atHour(5).nearMinute(5).inTimezone('Europe/Berlin').create();
  buildIndex();
  Logger.log('KEY: ' + props.getProperty('KEY'));
  Logger.log('Fertig. Jetzt als Web-App bereitstellen (Zugriff: Jeder).');
}

// ---------- Web-App ----------
function doGet(e) {
  if (!auth_(e)) return json_({ error: 'unauthorized' });
  if (e.parameter.refresh === '1') buildIndex();
  const f = file_('index.json');
  return ContentService.createTextOutput(f ? f.getBlob().getDataAsString() : '{"items":[]}').setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  if (!auth_(e)) return json_({ error: 'unauthorized' });
  // Kurzbefehl: {"items":[...]} mit source notes|reminders|icloud
  const body = JSON.parse(e.postData.contents || '{}');
  if (!Array.isArray(body.items)) return json_({ error: 'items fehlen' });
  write_('apple.json', JSON.stringify({ received: new Date().toISOString(), items: body.items }));
  buildIndex();
  return json_({ ok: true, items: body.items.length });
}
function auth_(e) { return e && e.parameter && e.parameter.key && e.parameter.key === PropertiesService.getScriptProperties().getProperty('KEY'); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------- Index ----------
function buildIndex() {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return;
  try {
    const items = listDrive_().concat(loadApple_());
    assignAreas_(items);
    const now = new Date().toISOString();
    const prevManifest = readJson_('manifest.json') || {};
    const manifest = {}; items.forEach(i => { manifest[i.id] = (i.modified || '') + '|' + i.name + '|' + (i.parent || ''); });
    const changes = readJson_('changes.json') || [];
    const seen = new Set();
    items.forEach(i => {
      seen.add(i.id); const prev = prevManifest[i.id];
      if (Object.keys(prevManifest).length === 0) return; // erster Lauf: kein Protokoll
      if (!prev) changes.push({ date: i.created || i.modified || now, type: 'new', id: i.id, name: i.name, source: i.source, area: i.area });
      else if (prev !== manifest[i.id]) { const [pm, pn, pp] = prev.split('|'); changes.push({ date: now, type: pp !== (i.parent || '') ? 'moved' : 'modified', id: i.id, name: i.name, source: i.source, area: i.area }); }
    });
    Object.keys(prevManifest).forEach(id => { if (!seen.has(id)) { const [, pn] = prevManifest[id].split('|'); changes.push({ date: now, type: 'deleted', id, name: pn, source: id.startsWith('n-') ? 'notes' : id.startsWith('r-') ? 'reminders' : id.startsWith('ic-') ? 'icloud' : 'drive' }); } });
    const cutoff = Date.now() - KEEP_CHANGES_DAYS * 864e5;
    const kept = changes.filter(c => new Date(c.date).getTime() > cutoff).slice(-500);
    const used = new Set(items.map(i => i.area));
    const index = { generated: now, sources: [
      { id: 'drive', name: 'Google Drive', kind: 'drive' }, { id: 'icloud', name: 'iCloud Drive', kind: 'icloud' },
      { id: 'notes', name: 'Notizen', kind: 'notes' }, { id: 'reminders', name: 'Erinnerungen', kind: 'reminders' }
    ], areas: AREAS.filter(a => used.has(a.id)), items, changes: kept.reverse() };
    write_('index.json', JSON.stringify(index));
    write_('manifest.json', JSON.stringify(manifest));
    write_('changes.json', JSON.stringify(kept.reverse()));
    Logger.log('Index: ' + items.length + ' Einträge, ' + kept.length + ' Änderungen');
  } finally { lock.releaseLock(); }
}

function listDrive_() {
  const root = DriveApp.getRootFolder().getId();
  const out = []; let token;
  do {
    const r = Drive.Files.list({ pageSize: 1000, pageToken: token, q: 'trashed = false', spaces: 'drive',
      fields: 'nextPageToken,files(id,name,mimeType,parents,modifiedTime,createdTime,size,webViewLink,shared,ownedByMe,hasThumbnail)' });
    (r.files || []).forEach(f => {
      if (f.id === root) return;
      const parent = f.parents && f.parents[0] && f.parents[0] !== root ? f.parents[0] : null;
      const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
      const it = { id: f.id, source: 'drive', parent, name: f.name, kind: isFolder ? 'folder' : 'file', modified: f.modifiedTime, created: f.createdTime, url: f.webViewLink };
      if (!isFolder) { it.type = typeOf_(f.mimeType, f.name); if (f.size) it.size = Number(f.size); }
      if (f.ownedByMe === false) it.shared = true;
      out.push(it);
    });
    token = r.nextPageToken;
  } while (token);
  // Einträge, deren Elternordner nicht in der Liste ist (z. B. tief geteilte Dateien), an die Wurzel hängen
  const ids = new Set(out.map(i => i.id)); out.forEach(i => { if (i.parent && !ids.has(i.parent)) i.parent = null; });
  return out;
}
function typeOf_(mime, name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (mime === 'application/vnd.google-apps.document') return 'gdoc';
  if (mime === 'application/vnd.google-apps.spreadsheet' || /^(xlsx|xls|csv|numbers)$/.test(ext)) return 'sheet';
  if (mime === 'application/vnd.google-apps.presentation' || /^(pptx|ppt|key)$/.test(ext)) return 'slides';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (/^(docx|doc|pages|rtf)$/.test(ext)) return 'docx';
  if (ext === 'md') return 'md';
  if (mime.startsWith('text/')) return 'txt';
  return 'other';
}
function loadApple_() {
  const a = readJson_('apple.json'); if (!a || !Array.isArray(a.items)) return [];
  const out = [], folders = {};
  const folderFor = (source, segs) => { // legt Ordnerketten an: notes:/Ordner, reminders:/Liste, icloud:/a/b
    let parent = null, key = source;
    segs.filter(Boolean).forEach(seg => { key += '/' + seg; if (!folders[key]) { folders[key] = { id: source.slice(0, 2) + '-f-' + Utilities.base64EncodeWebSafe(key).slice(0, 40), source, parent, name: seg, kind: 'folder', url: source === 'notes' ? 'mobilenotes://' : source === 'reminders' ? 'x-apple-reminderkit://' : 'shareddocuments:///' }; out.push(folders[key]); } parent = folders[key].id; });
    return parent;
  };
  a.items.forEach(i => {
    if (!i || !i.name || !i.source) return;
    const src = i.source; let segs = [];
    if (src === 'notes' && i.folder) segs = [i.folder];
    else if (src === 'reminders' && i.list) segs = [i.list];
    else if (src === 'icloud' && i.path) { segs = String(i.path).replace(/^.*?(iCloud Drive|iCloud~|Documents)\/?/, '').split('/').filter(Boolean); segs.pop(); }
    const parent = folderFor(src, segs);
    const id = i.id || (src.slice(0, 2) + '-' + Utilities.base64EncodeWebSafe(src + '|' + i.name + '|' + (i.created || '')).slice(0, 40));
    out.push({ id, source: src, parent, name: i.name, kind: 'file', type: src === 'notes' ? 'note' : src === 'reminders' ? 'reminder' : typeOf_(i.mime || '', i.name),
      modified: i.modified || i.created, created: i.created, size: isFinite(Number(i.size)) && Number(i.size) > 0 ? Number(i.size) : undefined, due: i.due || undefined, done: i.done === true || i.done === 'true' || undefined, snippet: i.snippet || undefined,
      url: src === 'notes' ? 'mobilenotes://' : src === 'reminders' ? 'x-apple-reminderkit://' : 'shareddocuments:///' });
  });
  return out;
}
function assignAreas_(items) {
  const by = {}; items.forEach(i => by[i.id] = i);
  const rules = RULES.slice().sort((a, b) => b.prefix.length - a.prefix.length);
  items.forEach(it => {
    const p = []; let cur = it, guard = 0; while (cur && guard++ < 50) { p.unshift(cur.name); cur = cur.parent ? by[cur.parent] : null; }
    const path = it.source + ':/' + p.join('/');
    it.area = DEFAULT_AREA;
    for (const r of rules) { const pre = r.prefix.replace(/\/$/, ''); if (path === pre || path.indexOf(pre + '/') === 0) { it.area = r.area; break; } }
  });
}

// ---------- Dateien im Ordner „Explorer-App“ ----------
function folder_() { const it = DriveApp.getFoldersByName(FOLDER_NAME); return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME); }
function file_(name) { const it = folder_().getFilesByName(name); return it.hasNext() ? it.next() : null; }
function write_(name, text) { const f = file_(name); if (f) f.setContent(text); else folder_().createFile(name, text, 'application/json'); }
function readJson_(name) { const f = file_(name); if (!f) return null; try { return JSON.parse(f.getBlob().getDataAsString()); } catch (e) { return null; } }
