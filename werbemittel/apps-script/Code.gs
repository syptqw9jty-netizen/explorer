/**
 * GAUSS Werbemittel – gemeinsamer Speicher in Google Sheets und Google Drive.
 * Gleiches Muster wie die Design Bibliothek.
 *
 * Einrichtung (einmalig, ca. 10 Minuten):
 * 1. Neue Google-Tabelle anlegen, z. B. „GAUSS Werbemittel“ (im Firmen-Workspace).
 * 2. Erweiterungen → Apps Script. Diesen Code einfügen, speichern.
 * 3. Optional für „Mit KI ausfüllen“: Projekteinstellungen → Skripteigenschaften →
 *    ANTHROPIC_API_KEY = API-Schlüssel (console.anthropic.com).
 *    Optional ANTHROPIC_MODEL (Standard: claude-sonnet-5-5).
 * 4. Bereitstellen → Neue Bereitstellung → Typ „Web-App“, Ausführen als: Ich.
 *    Zugriff: empfohlen „Jeder in <Firma>“ (nur angemeldete Mitarbeitende).
 * 5. Die Web-App-URL in werbemittel/index.html bei CONFIG.API_URL eintragen.
 *
 * 6. Optional, tägliche Nachbestell-Erinnerung: Funktion „einrichtenErinnerung“ einmal ausführen.
 *    Die Mail geht an die Adresse unter Verwaltung → Bestelldaten → „Rechnungen an“, sonst an das Skript-Konto.
 *
 * Blätter für Artikel, Vorgänge, Buchungen, Kommentare, Lieferanten, Bestellungen und Einstellungen
 * entstehen beim ersten Aufruf. Die Verwaltungs-PIN liegt nur als Hash in „Einstellungen“.
 * Jede Zeile: id | json | aktualisiert. Fotos landen im Drive-Ordner „GAUSS Werbemittel Fotos“.
 * Für Auswertungen in Sheets: =MAP oder Apps-Script-Export; die App bietet CSV-Exporte.
 */
const SAMMLUNGEN = { artikel: 'Artikel', vorgaenge: 'Vorgaenge', buchungen: 'Buchungen', kommentare: 'Kommentare', lieferanten: 'Lieferanten', bestellungen: 'Bestellungen', einstellungen: 'Einstellungen' };
const ORDNER = 'GAUSS Werbemittel Fotos';
const ID = /^[A-Za-z0-9_\-.:@+~]{1,120}$/;
const MAX_ZELLE = 48000;
const MAX_FOTO_MB = 8;
const PROPS = PropertiesService.getScriptProperties();

/* ---------- Grundlagen ---------- */
function blatt_(col) {
  const name = SAMMLUNGEN[col]; if (!name) throw new Error('Unbekannte Sammlung.');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, s.getMaxRows(), 3).setNumberFormat('@');
    s.appendRow(['id', 'json', 'aktualisiert']);
    s.setFrozenRows(1);
  }
  return s;
}
function liste_(col) {
  const w = blatt_(col).getDataRange().getValues(); w.shift();
  return w.filter(r => r[0]).map(r => { try { return Object.assign(JSON.parse(r[1]), { id: String(r[0]) }); } catch (e) { return null; } }).filter(Boolean);
}
function zeile_(s, id) {
  const n = s.getLastRow(); if (n < 2) return 0;
  const ids = s.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}
function antwort_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function fehler_(text, code) { return antwort_({ ok: false, error: text, code: code || 'api' }); }
function pruefen_(p) {
  if (!SAMMLUNGEN[p.col]) throw new Error('Unbekannte Sammlung.');
  if (!ID.test(String(p.id || ''))) throw new Error('Ungültige Kennung.');
}

/* ---------- Schreiben ---------- */
function setzen_(col, id, data, mischen) {
  const s = blatt_(col), z = zeile_(s, id);
  let obj = data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  if (!obj) throw new Error('Ungültige Daten.');
  if (mischen) {
    if (!z) throw new Error('Eintrag nicht gefunden.');
    let alt = {}; try { alt = JSON.parse(s.getRange(z, 2).getValue()); } catch (e) {}
    obj = Object.assign(alt, obj);
  }
  delete obj.id;
  const text = JSON.stringify(obj);
  if (text.length > MAX_ZELLE) throw new Error('Eintrag zu groß.');
  const werte = [[id, text, new Date().toISOString()]];
  if (z) s.getRange(z, 1, 1, 3).setValues(werte); else s.appendRow(werte[0]);
  return { ok: true };
}
function loeschen_(col, id) {
  const s = blatt_(col), z = zeile_(s, id);
  if (z) s.deleteRow(z);
  return { ok: true };
}

/* ---------- Fotos ---------- */
function ordner_() {
  const it = DriveApp.getFoldersByName(ORDNER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(ORDNER);
}
function hochladen_(p) {
  const m = String(p.dataUrl || '').match(/^data:(image\/(png|jpeg|webp));base64,(.+)$/);
  if (!m) throw new Error('Nur PNG, JPEG oder WebP.');
  const bytes = Utilities.base64Decode(m[3]);
  if (bytes.length > MAX_FOTO_MB * 1024 * 1024) throw new Error('Das Foto ist zu groß.');
  const name = 'werbemittel-' + Utilities.getUuid() + '.' + (m[2] === 'jpeg' ? 'jpg' : m[2]);
  const datei = ordner_().createFile(Utilities.newBlob(bytes, m[1], name));
  try { datei.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (e) { try { datei.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } catch (e2) {} }
  const id = datei.getId();
  // lh3-Adresse liefert das Original inklusive Transparenz
  return { ok: true, id: id, url: 'https://lh3.googleusercontent.com/d/' + id + '=w1600' };
}

/* ---------- KI: Artikel aus Foto erkennen ---------- */
function ki_(p) {
  const key = PROPS.getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('KI ist nicht eingerichtet.');
  const inhalt = [];
  const m = String(p.bild || '').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (m) inhalt.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  inhalt.push({ type: 'text', text: String(p.prompt || '').slice(0, 6000) });
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: PROPS.getProperty('ANTHROPIC_MODEL') || 'claude-sonnet-5-5', max_tokens: 1200, messages: [{ role: 'user', content: inhalt }] })
  });
  if (res.getResponseCode() !== 200) throw new Error('KI gerade nicht erreichbar.');
  const text = (JSON.parse(res.getContentText()).content || []).map(c => c.text || '').join('');
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('Die KI hat nichts Verwertbares geliefert.');
  return { ok: true, wert: JSON.parse(text.slice(a, b + 1)) };
}

/* ---------- Einstieg ---------- */
function doGet() {
  try {
    const data = {}; Object.keys(SAMMLUNGEN).forEach(c => { data[c] = liste_(c); });
    return antwort_({ ok: true, data: data, ki: !!PROPS.getProperty('ANTHROPIC_API_KEY') });
  } catch (err) { console.error('doGet', err); return fehler_('Laden fehlgeschlagen. Bitte gleich noch einmal versuchen.'); }
}
function doPost(e) {
  let p; try { p = JSON.parse(e.postData.contents); } catch (err) { return fehler_('Ungültige Anfrage.'); }
  if (p.action === 'ki') { try { return antwort_(ki_(p)); } catch (err) { return fehler_(err.message); } }
  if (p.action === 'upload') { try { return antwort_(hochladen_(p)); } catch (err) { return fehler_(err.message); } }
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    pruefen_(p);
    if (p.action === 'set') return antwort_(setzen_(p.col, p.id, p.data, false));
    if (p.action === 'update') return antwort_(setzen_(p.col, p.id, p.data, true));
    if (p.action === 'del') return antwort_(loeschen_(p.col, p.id));
    return fehler_('Unbekannte Aktion.');
  } catch (err) {
    console.error('doPost', err); return fehler_(err.message || 'Speichern fehlgeschlagen.');
  } finally { try { lock.releaseLock(); } catch (e2) {} }
}

/* ---------- Tägliche Nachbestell-Erinnerung (optional) ---------- */
function einrichtenErinnerung() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'nachbestellErinnerung').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('nachbestellErinnerung').timeBased().everyDays(1).atHour(7).inTimezone('Europe/Berlin').create();
}
function nachbestellErinnerung() {
  const artikel = liste_('artikel').filter(a => a.aktiv !== false && Number(a.mindest) > 0);
  const bestand = {}; liste_('buchungen').forEach(b => { bestand[b.artikelId] = (bestand[b.artikelId] || 0) + Number(b.menge || 0); });
  const unterwegs = {};
  liste_('bestellungen').filter(b => b.status === 'bestellt' || b.status === 'teilweise').forEach(b => (b.positionen || []).forEach(p => { unterwegs[p.artikelId] = (unterwegs[p.artikelId] || 0) + Number(p.menge || 0); }));
  const knapp = artikel.filter(a => (bestand[a.id] || 0) + (unterwegs[a.id] || 0) <= Number(a.mindest));
  if (!knapp.length) return;
  const einst = liste_('einstellungen').find(x => x.id === 'verwaltung') || {};
  const an = einst.rechnungsmail || Session.getEffectiveUser().getEmail();
  const text = knapp.map(a => '- ' + a.name + ': Bestand ' + (bestand[a.id] || 0) + ', Mindestbestand ' + a.mindest + (a.lieferant ? ' (' + a.lieferant + ')' : '')).join('\n');
  MailApp.sendEmail(an, 'Werbemittel: ' + knapp.length + ' Artikel nachbestellen', 'Diese Artikel liegen am oder unter dem Mindestbestand und sind noch nicht bestellt:\n\n' + text + '\n\nIn der App unter Verwaltung → Nachbestellen.');
}
