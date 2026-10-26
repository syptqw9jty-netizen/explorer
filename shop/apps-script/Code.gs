/**
 * GAUSS Shop – Server für die eigenständige App (PWA) auf GitHub Pages.
 * Speicher in Google Sheets, Fotos in Google Drive, Mails über Gmail des Skript-Kontos.
 * Gleiches Muster wie Werbemittel und Design Bibliothek, dazu Anmeldung per Mail-Code.
 *
 * Einrichtung (einmalig, ca. 10 Minuten):
 * 1. Neue Google-Tabelle anlegen, z. B. „GAUSS Shop“ (im Firmen-Workspace, Konto der Shop-Verwaltung).
 * 2. Erweiterungen → Apps Script. Diesen Code einfügen, speichern.
 * 3. Projekteinstellungen → Skripteigenschaften:
 *      DOMAIN  = gauss-lvs.de            (nur Adressen dieser Domain dürfen sich anmelden; mehrere mit Komma)
 *      ADMINS  = name@gauss-lvs.de, …    (Verwaltung; das Skript-Konto ist immer Admin)
 *    Der geheime Signaturschlüssel entsteht beim ersten Aufruf automatisch.
 * 4. Funktion „einrichten“ einmal ausführen und Berechtigungen bestätigen (Tabelle, Drive, Gmail, Mail).
 * 5. Bereitstellen → Neue Bereitstellung → Typ „Web-App“, Ausführen als: Ich, Zugriff: Jeder.
 *    (Die App meldet Personen selbst per Mail-Code an; „Jeder“ ist nötig, damit GitHub Pages zugreifen kann.)
 * 6. Die Web-App-URL in shop/index.html bei CONFIG.API_URL eintragen.
 *
 * Rechte wie im Claude-Artifact:
 *  - Sortiment, Bestand (Reservierungen) und Einstellungen sehen alle Angemeldeten.
 *  - Bestellungen sieht jede Person nur selbst, die Verwaltung alle.
 *  - Gutscheine und Lieferanten nur die Verwaltung; Gutscheine werden über einen Hash geprüft.
 * Jede Zeile: id | json | aktualisiert.
 */
const SAMMLUNGEN = {
  produkte: 'Produkte', reservierungen: 'Reservierungen', einstellungen: 'Einstellungen',
  bestellungen: 'Bestellungen', gutscheine: 'Gutscheine', gutscheinpruefung: 'Gutscheinpruefung', lieferanten: 'Lieferanten'
};
const NUR_ADMIN_LESEN = ['gutscheine', 'lieferanten'];
const NUR_ADMIN_SCHREIBEN = ['produkte', 'einstellungen', 'gutscheine', 'gutscheinpruefung', 'lieferanten'];
const ORDNER = 'GAUSS Shop Fotos';
const ID = /^[A-Za-z0-9_\-.:@+~]{1,160}$/;
const MAX_ZELLE = 48000;
const MAX_FOTO_MB = 8;
const TOKEN_TAGE = 60;
const PROPS = PropertiesService.getScriptProperties();

/* ---------- Einrichtung ---------- */
function einrichten() {
  geheimnis_();
  Object.keys(SAMMLUNGEN).forEach(blatt_);
  ordner_();
  GmailApp.getAliases();
  console.log('Fertig. Admin: ' + Session.getEffectiveUser().getEmail());
}
function geheimnis_() {
  let g = PROPS.getProperty('GEHEIMNIS');
  if (!g) { g = Utilities.getUuid() + Utilities.getUuid(); PROPS.setProperty('GEHEIMNIS', g); }
  return g;
}

/* ---------- Tabelle ---------- */
function blatt_(col) {
  const name = SAMMLUNGEN[col]; if (!name) throw fehlerObj_('Unbekannte Sammlung.');
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
function alle_(col) {
  const w = blatt_(col).getDataRange().getValues(); w.shift();
  const o = {};
  w.forEach(r => { if (!r[0]) return; try { o[String(r[0])] = JSON.parse(r[1]); } catch (e) {} });
  return o;
}
function zeile_(s, id) {
  const n = s.getLastRow(); if (n < 2) return 0;
  const ids = s.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}
function lesen_(col, id) {
  const s = blatt_(col), z = zeile_(s, id); if (!z) return null;
  try { return JSON.parse(s.getRange(z, 2).getValue()); } catch (e) { return null; }
}
function mischen_(alt, neu) {
  const o = Object.assign({}, alt || {});
  Object.keys(neu).forEach(k => {
    const v = neu[k];
    o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? mischen_(o[k], v) : v;
  });
  return o;
}
function schreiben_(col, id, data, art) {
  const s = blatt_(col), z = zeile_(s, id);
  if (art === 'del') { if (z) s.deleteRow(z); return; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw fehlerObj_('Ungültige Daten.');
  let obj = data;
  if (art === 'update') {
    if (!z) throw fehlerObj_('Eintrag nicht gefunden.', 'invalid_argument');
    let alt = {}; try { alt = JSON.parse(s.getRange(z, 2).getValue()); } catch (e) {}
    obj = mischen_(alt, data);
  }
  delete obj.id;
  const text = JSON.stringify(obj);
  if (text.length > MAX_ZELLE) throw fehlerObj_('Eintrag zu groß.', 'quota_exceeded');
  const werte = [[id, text, new Date().toISOString()]];
  if (z) s.getRange(z, 1, 1, 3).setValues(werte); else s.appendRow(werte[0]);
}

/* ---------- Anmeldung per Mail-Code ---------- */
function domainOk_(email) {
  const d = String(PROPS.getProperty('DOMAIN') || '').toLowerCase().split(/[\s,;]+/).filter(Boolean);
  if (!d.length) return true;
  return d.indexOf(email.split('@')[1]) >= 0;
}
function istAdmin_(email) {
  const a = String(PROPS.getProperty('ADMINS') || '').toLowerCase().split(/[\s,;]+/).filter(Boolean);
  return email === Session.getEffectiveUser().getEmail().toLowerCase() || a.indexOf(email) >= 0;
}
function signatur_(text) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(text, geheimnis_())).replace(/=+$/, '');
}
function token_(email) {
  const bis = Date.now() + TOKEN_TAGE * 864e5;
  const roh = Utilities.base64EncodeWebSafe(email + '|' + bis).replace(/=+$/, '');
  return roh + '.' + signatur_(roh);
}
function person_(token) {
  if (!token) return null;
  const teile = String(token).split('.'); if (teile.length !== 2) return null;
  if (signatur_(teile[0]) !== teile[1]) return null;
  const roh = Utilities.newBlob(Utilities.base64DecodeWebSafe(teile[0] + '==='.slice((teile[0].length + 3) % 4))).getDataAsString();
  const [email, bis] = roh.split('|');
  if (!email || Number(bis) < Date.now()) return null;
  const id = 'e_' + signatur_('id:' + email).slice(0, 22);
  return { id: id, email: email, name: email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), admin: istAdmin_(email) };
}
function codeSenden_(p) {
  const email = String(p.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fehlerObj_('Bitte eine gültige E-Mail-Adresse eingeben.');
  if (!domainOk_(email)) throw fehlerObj_('Anmelden können nur Firmen-Adressen.');
  const cache = CacheService.getScriptCache();
  const sperre = 'sperre:' + email;
  if (cache.get(sperre)) throw fehlerObj_('Der Code wurde gerade erst gesendet. Bitte kurz warten.');
  const code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('code:' + email, code, 600); cache.put(sperre, '1', 45);
  MailApp.sendEmail(email, 'Dein Code für den GAUSS Shop: ' + code,
    'Dein Anmeldecode für den Mitarbeitershop lautet ' + code + '.\n\nEr gilt 10 Minuten. Falls du dich nicht anmelden wolltest, ignoriere diese Mail.');
  return { ok: true };
}
function anmelden_(p) {
  const email = String(p.email || '').trim().toLowerCase(), cache = CacheService.getScriptCache();
  const versuche = Number(cache.get('versuch:' + email) || 0);
  if (versuche >= 5) throw fehlerObj_('Zu viele Versuche. Bitte einen neuen Code anfordern.');
  const soll = cache.get('code:' + email);
  if (!soll || soll !== String(p.code || '').trim()) {
    cache.put('versuch:' + email, String(versuche + 1), 600);
    throw fehlerObj_('Der Code stimmt nicht oder ist abgelaufen.');
  }
  cache.remove('code:' + email); cache.remove('versuch:' + email);
  return { ok: true, token: token_(email) };
}

/* ---------- Rechte ---------- */
function darfLesen_(wer, col, id) {
  if (!wer) return false;
  if (NUR_ADMIN_LESEN.indexOf(col) >= 0) return wer.admin;
  if (col === 'bestellungen') return wer.admin || id === wer.id;
  return true;
}
function darfSchreiben_(wer, col, id) {
  if (!wer) return false;
  if (wer.admin) return true;
  if (NUR_ADMIN_SCHREIBEN.indexOf(col) >= 0) return false;
  if (col === 'bestellungen') return id === wer.id;
  return col === 'reservierungen';
}
function liste_(wer) {
  const data = {
    produkte: alle_('produkte'),
    reservierungen: alle_('reservierungen'),
    einstellungen: alle_('einstellungen')
  };
  if (wer.admin) {
    data.bestellungen = alle_('bestellungen');
    data.gutscheine = alle_('gutscheine');
    data.lieferanten = alle_('lieferanten');
  } else {
    const eigene = lesen_('bestellungen', wer.id);
    data.bestellungen = eigene ? { [wer.id]: eigene } : {};
  }
  return { ok: true, me: wer, data: data };
}

/* ---------- Fotos ---------- */
function ordner_() {
  const it = DriveApp.getFoldersByName(ORDNER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(ORDNER);
}
function hochladen_(p) {
  const m = String(p.dataUrl || '').match(/^data:(image\/(png|jpeg|webp));base64,(.+)$/);
  if (!m) throw fehlerObj_('Nur PNG, JPEG oder WebP.');
  const bytes = Utilities.base64Decode(m[3]);
  if (bytes.length > MAX_FOTO_MB * 1024 * 1024) throw fehlerObj_('Das Foto ist zu groß.');
  const datei = ordner_().createFile(Utilities.newBlob(bytes, m[1], 'shop-' + Utilities.getUuid() + '.' + (m[2] === 'jpeg' ? 'jpg' : m[2])));
  try { datei.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (e) { try { datei.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } catch (e2) {} }
  return { ok: true, id: datei.getId(), url: 'https://lh3.googleusercontent.com/d/' + datei.getId() + '=w2000' };
}

/* ---------- Mail (Lieferanten, Rechnungen, Monatsbericht) ---------- */
function mail_(p) {
  const an = (p.to || []).join(','), cc = (p.cc || []).join(',');
  if (!an) throw fehlerObj_('Empfänger fehlt.');
  const anhang = (p.attachments || []).map(a => Utilities.newBlob(Utilities.base64Decode(a.content), a.mimeType || 'application/octet-stream', a.filename || 'Anhang'));
  const opt = { attachments: anhang };
  if (cc) opt.cc = cc;
  const shop = (alle_('einstellungen').allgemein || {}).shopEmail;
  if (shop) opt.replyTo = shop;
  if (p.modus === 'senden') GmailApp.sendEmail(an, String(p.subject || ''), String(p.body || ''), opt);
  else GmailApp.createDraft(an, String(p.subject || ''), String(p.body || ''), opt);
  return { ok: true };
}

/* ---------- Einstieg ---------- */
function antwort_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function fehlerObj_(text, code) { const e = new Error(text); e.code = code || 'api'; return e; }
function doGet() { return antwort_({ ok: true, dienst: 'GAUSS Shop', hinweis: 'Die App spricht per POST mit diesem Dienst.' }); }
function doPost(e) {
  let p; try { p = JSON.parse(e.postData.contents); } catch (err) { return antwort_({ ok: false, error: 'Ungültige Anfrage.' }); }
  try {
    if (p.action === 'code') return antwort_(codeSenden_(p));
    if (p.action === 'anmelden') return antwort_(anmelden_(p));
    const wer = person_(p.token);
    if (!wer) return antwort_({ ok: false, code: 'anmeldung', error: 'Bitte neu anmelden.' });
    if (p.action === 'liste') return antwort_(liste_(wer));
    if (p.action === 'upload') { if (!wer.admin) throw fehlerObj_('Nur für die Verwaltung.', 'invalid_argument'); return antwort_(hochladen_(p)); }
    if (p.action === 'mail') { if (!wer.admin) throw fehlerObj_('Nur für die Verwaltung.', 'invalid_argument'); return antwort_(mail_(p)); }
    if (!SAMMLUNGEN[p.col] || !ID.test(String(p.id || ''))) throw fehlerObj_('Ungültige Kennung.', 'invalid_argument');
    if (p.action === 'get') {
      if (p.col === 'gutscheinpruefung') return antwort_({ ok: true, doc: lesen_(p.col, p.id) });
      if (!darfLesen_(wer, p.col, p.id)) throw fehlerObj_('Keine Berechtigung.', 'invalid_argument');
      return antwort_({ ok: true, doc: lesen_(p.col, p.id) });
    }
    if (['set', 'update', 'del'].indexOf(p.action) < 0) throw fehlerObj_('Unbekannte Aktion.');
    if (!darfSchreiben_(wer, p.col, p.id)) throw fehlerObj_('Keine Berechtigung zum Speichern.', 'invalid_argument');
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try { schreiben_(p.col, p.id, p.data, p.action); } finally { lock.releaseLock(); }
    return antwort_({ ok: true });
  } catch (err) {
    console.error('doPost', p && p.action, err);
    return antwort_({ ok: false, error: err.message || 'Fehler.', code: err.code || 'api' });
  }
}
