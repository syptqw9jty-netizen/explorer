/**
 * GAUSS Design Bibliothek – gemeinsamer Speicher in Google Sheets und Google Drive.
 *
 * Einrichtung (einmalig, ca. 10 Minuten):
 * 1. Neue Google-Tabelle anlegen, z. B. „GAUSS Design Bibliothek“ (im Firmen-Workspace).
 * 2. Erweiterungen → Apps Script. Diesen Code einfügen, speichern.
 * 3. Optional für „Mit KI ausfüllen“: Projekteinstellungen → Skripteigenschaften →
 *    ANTHROPIC_API_KEY = API-Schlüssel (console.anthropic.com).
 *    Optional ANTHROPIC_MODEL (Standard: claude-sonnet-5-5).
 * 4. Bereitstellen → Neue Bereitstellung → Typ „Web-App“, Ausführen als: Ich.
 *    Zugriff: empfohlen „Jeder in <Firma>“ (nur angemeldete Mitarbeitende).
 *    „Jeder“ nur, wenn Kolleg:innen ohne Google-Konto zugreifen sollen – dann ist die
 *    Datenschnittstelle öffentlich erreichbar (siehe Beratungsunterlage).
 * 5. Die Web-App-URL in index.html bei CONFIG.API_URL eintragen.
 * 6. Beim ersten Öffnen der Verwaltung mit 0000 anmelden und sofort eine eigene PIN setzen.
 *    Solange keine eigene PIN gesetzt ist, sind alle anderen Verwaltungsaktionen gesperrt.
 *
 * Blätter „Buecher“, „Ausleihen“, „Bewertungen“ und „Feedback“ entstehen beim ersten Aufruf.
 * Feedback ist nur über die Verwaltung (PIN) lesbar, nicht über die öffentliche Abfrage.
 * Bilder und Videos landen im Drive-Ordner „GAUSS Design Bibliothek Medien“.
 * PIN nur als Hash gespeichert; nach 5 Fehlversuchen 10 Minuten Sperre.
 */
const LEIHTAGE = 28;
const BLAETTER = {
  Buecher: ['id', 'json', 'aktualisiert'],
  Ausleihen: ['id', 'buchId', 'kuerzel', 'ausgeliehenAm', 'faelligAm', 'verlaengert', 'zurueckAm'],
  Bewertungen: ['id', 'buchId', 'kuerzel', 'sterne', 'kommentar', 'am', 'medien'],
  Feedback: ['id', 'sterne', 'text', 'kuerzel', 'am']
};
const KUERZEL = /^[A-ZÄÖÜ]{2,3}$/;
const MAX_MB = { bild: 8, video: 15 };          // Base64 im POST-Body: 15 MB Video ≈ 20 MB Anfrage
const UPLOADS_PRO_TAG = 150;
const PROPS = PropertiesService.getScriptProperties();
const PIN_AKTIONEN = ['checkPin', 'setPin', 'saveBook', 'deleteRating', 'updateRating', 'analyze', 'listFeedback', 'deleteFeedback'];

/* ---------- Grundlagen ---------- */
function blatt_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, s.getMaxRows(), BLAETTER[name].length).setNumberFormat('@');
    s.appendRow(BLAETTER[name]);
    s.setFrozenRows(1);
  }
  return s;
}
function zeilen_(name) { const w = blatt_(name).getDataRange().getValues(); w.shift(); return w; }
function iso_(v) { return v instanceof Date ? v.toISOString() : String(v || ''); }
function plusTage_(isoText, n) { const d = new Date(isoText); d.setDate(d.getDate() + n); return d.toISOString(); }
function json_(t, d) { try { return JSON.parse(t); } catch (e) { return d; } }
function antwort_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function fehler_(text) { return antwort_({ ok: false, error: text }); }

function buecher_() { return zeilen_('Buecher').filter(r => r[0]).map(r => json_(r[1], null)).filter(Boolean); }
function ausleihen_() {
  return zeilen_('Ausleihen').filter(r => r[0]).map(r => ({
    id: String(r[0]), bookId: String(r[1]), kuerzel: String(r[2]), borrowedAt: iso_(r[3]), dueAt: iso_(r[4]),
    extended: String(r[5]).toUpperCase() === 'TRUE', returnedAt: r[6] ? iso_(r[6]) : null
  }));
}
function bewertungen_() {
  return zeilen_('Bewertungen').filter(r => r[0]).map(r => ({
    id: String(r[0]), bookId: String(r[1]), kuerzel: String(r[2]),
    sterne: Math.max(0, Math.min(5, parseInt(r[3], 10) || 0)), kommentar: String(r[4] || ''), am: iso_(r[5]), medien: json_(r[6], [])
  }));
}
function feedback_() {
  return zeilen_('Feedback').filter(r => r[0]).map(r => ({ id: String(r[0]), sterne: parseInt(r[1], 10) || 0, text: String(r[2] || ''), kuerzel: String(r[3] || ''), am: iso_(r[4]) }));
}
function zustand_() { return { ok: true, books: buecher_(), loans: ausleihen_(), ratings: bewertungen_() }; }

/* ---------- PIN (läuft unter Lock, damit der Fehlversuchszähler nicht umgangen wird) ---------- */
function hash_(pin) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'gauss-buecherei:' + pin, Utilities.Charset.UTF_8));
}
function pinPruefen_(pin, aktion) {
  if (!/^\d{4}$/.test(String(pin || ''))) return 'PIN ist nicht richtig.';        // fehlende/ungültige PIN zählt nicht als Versuch
  const cache = CacheService.getScriptCache();
  const fehl = parseInt(cache.get('pin_fehl') || '0', 10);
  if (fehl >= 5) return 'Zu viele Versuche. Bitte in 10 Minuten erneut probieren.';
  const gesetzt = PROPS.getProperty('ADMIN_PIN_HASH');
  if (hash_(String(pin)) === (gesetzt || hash_('0000'))) {
    cache.remove('pin_fehl');
    if (!gesetzt && aktion !== 'checkPin' && aktion !== 'setPin') return 'Bitte zuerst eine eigene PIN festlegen.';
    return null;
  }
  cache.put('pin_fehl', String(fehl + 1), 600);
  return 'PIN ist nicht richtig.';
}

/* ---------- Medien in Drive ---------- */
function ordner_() {
  const id = PROPS.getProperty('MEDIEN_ORDNER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder('GAUSS Design Bibliothek Medien');
  PROPS.setProperty('MEDIEN_ORDNER', f.getId());
  return f;
}
function dateiId_(url) { const m = String(url || '').match(/(?:id=|\/d\/)([\w-]{20,})/); return m ? m[1] : null; }
function papierkorb_(medien) {
  (medien || []).forEach(m => { const id = dateiId_(m && m.url); if (id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { console.warn('Papierkorb', id, e); } } });
}
function medienSauber_(liste) {
  return (Array.isArray(liste) ? liste : []).slice(0, 4).filter(m => m && /^https:\/\/drive\.google\.com\//.test(m.url || ''))
    .map(m => ({ typ: m.typ === 'video' ? 'video' : 'bild', url: String(m.url), thumb: String(m.thumb || '') }));
}
function hochladen_(p) {
  const typ = p.typ === 'video' ? 'video' : 'bild';
  const mime = String(p.mime || '');
  if (!(typ === 'bild' ? /^image\/(jpeg|png|webp)$/ : /^video\/(mp4|quicktime|webm)$/).test(mime)) return fehler_('Dateiformat wird nicht unterstützt (Videos: MP4, MOV, WebM).');
  const cache = CacheService.getScriptCache(), heute = 'uploads_' + new Date().toISOString().slice(0, 10);
  const anzahl = parseInt(cache.get(heute) || '0', 10);
  if (anzahl >= UPLOADS_PRO_TAG) return fehler_('Tageslimit für Uploads erreicht. Bitte morgen erneut versuchen.');
  const bytes = Utilities.base64Decode(String(p.data || ''));
  if (!bytes.length || bytes.length > MAX_MB[typ] * 1048576) return fehler_(`Die Datei ist zu groß (höchstens ${MAX_MB[typ]} MB).`);
  const datei = ordner_().createFile(Utilities.newBlob(bytes, mime, (p.zweck === 'cover' ? 'cover' : 'kommentar') + '-' + Date.now()));
  try { datei.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (e) {
    try { datei.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); }
    catch (e2) { datei.setTrashed(true); console.error('Freigabe', e2); return fehler_('Die Datei konnte nicht freigegeben werden. Bitte die Drive-Freigaberegeln des Workspace prüfen.'); }
  }
  cache.put(heute, String(anzahl + 1), 86400);
  const id = datei.getId();
  return antwort_({ ok: true, medium: {
    typ: typ,
    url: typ === 'video' ? 'https://drive.google.com/file/d/' + id + '/preview' : 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600',
    thumb: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w320'
  } });
}

/* ---------- KI-Analyse (optional) ---------- */
function analysieren_(bilder) {
  const key = PROPS.getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('KI-Analyse ist nicht eingerichtet (Skripteigenschaft ANTHROPIC_API_KEY fehlt).');
  const prompt = 'Das sind Fotos eines Buchs (Cover und/oder Rückseite). Gib NUR ein JSON-Objekt zurück mit den Schlüsseln ' +
    'titel, autor (mehrere mit Komma), verlag, jahr (Zahl oder null), seiten (Zahl oder null), sprache (deutsch ausgeschrieben, z. B. "Deutsch"), ' +
    'isbn (nur Ziffern, ISBN-13 wenn sichtbar, sonst null), themen (Array, nur aus: Belletristik, Design, Führung, Gesellschaft, Layout, Methoden, ' +
    'Produkt, Psychologie, Technik, Typografie, UI, UX, Web) und beschreibung (2–3 Sätze auf Deutsch in eigenen Worten, ' +
    'keine wörtlichen Zitate aus dem Klappentext). Unbekanntes als null. Kein Text außerhalb des JSON.';
  const content = bilder.slice(0, 2).map(b => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b } }));
  content.push({ type: 'text', text: prompt });
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: PROPS.getProperty('ANTHROPIC_MODEL') || 'claude-sonnet-5-5', max_tokens: 1200, messages: [{ role: 'user', content: content }] })
  });
  const j = json_(res.getContentText(), {});
  if (res.getResponseCode() !== 200) throw new Error('KI-Analyse fehlgeschlagen: ' + ((j.error && j.error.message) || res.getResponseCode()));
  const text = (j.content || []).map(c => c.text || '').join('');
  const daten = json_(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1), null);
  if (!daten) throw new Error('Die KI-Antwort war nicht lesbar. Bitte noch einmal versuchen.');
  return daten;
}

/* ---------- Web-App ---------- */
function doGet() {
  try { return antwort_(zustand_()); }
  catch (err) { console.error('doGet', err); return fehler_('Laden fehlgeschlagen. Bitte gleich noch einmal versuchen.'); }
}

function doPost(e) {
  const p = json_((e && e.postData && e.postData.contents) || '{}', {});
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return fehler_('Gerade viel los. Bitte gleich noch einmal versuchen.');
  let gesperrt = true;
  try {
    if (PIN_AKTIONEN.indexOf(p.action) >= 0 || (p.action === 'upload' && p.zweck === 'cover')) {
      const f = pinPruefen_(p.pin, p.action); if (f) return fehler_(f);
    }
    // Lange Aktionen ohne Datenänderung: Lock vorher freigeben
    if (p.action === 'checkPin') return antwort_({ ok: true, eigenePin: !!PROPS.getProperty('ADMIN_PIN_HASH') });
    if (p.action === 'analyze' || p.action === 'upload') {
      lock.releaseLock(); gesperrt = false;
      if (p.action === 'analyze') return antwort_({ ok: true, daten: analysieren_(Array.isArray(p.bilder) ? p.bilder : []) });
      return hochladen_(p);
    }

    const jetzt = new Date().toISOString();
    if (p.action === 'setPin') {
      if (!/^\d{4}$/.test(String(p.neu || ''))) return fehler_('Die neue PIN braucht vier Ziffern.');
      if (String(p.neu) === '0000') return fehler_('Bitte eine andere PIN als 0000 wählen.');
      PROPS.setProperty('ADMIN_PIN_HASH', hash_(String(p.neu)));
      return antwort_({ ok: true });
    }
    if (p.action === 'saveBook') {
      const b = p.book || {};
      if (!b.id || !String(b.titel || '').trim()) return fehler_('Titel fehlt.');
      const s = blatt_('Buecher');
      if (s.getLastRow() < 2 && Array.isArray(p.seed)) p.seed.filter(x => x && x.id && x.id !== b.id).forEach(x => s.appendRow([x.id, JSON.stringify(x), jetzt]));
      const text = JSON.stringify(b);
      if (text.length > 45000) return fehler_('Der Eintrag ist zu lang.');
      const w = s.getDataRange().getValues();
      const i = w.findIndex((r, idx) => idx > 0 && r[0] === b.id);
      if (i > 0) s.getRange(i + 1, 2, 1, 2).setValues([[text, jetzt]]); else s.appendRow([b.id, text, jetzt]);
    } else if (p.action === 'feedback') {
      const sterne = parseInt(p.sterne, 10) || 0, text = String(p.text || '').trim().slice(0, 1000), kuerzel = String(p.kuerzel || '').toUpperCase();
      if (sterne < 0 || sterne > 5) return fehler_('Bitte 0 bis 5 Sterne wählen.');
      if (kuerzel && !KUERZEL.test(kuerzel)) return fehler_('Kürzel bitte mit 2 oder 3 Buchstaben oder leer lassen.');
      if (!sterne && !text) return fehler_('Bitte Sterne vergeben oder ein paar Worte schreiben.');
      blatt_('Feedback').appendRow([Utilities.getUuid(), String(sterne), text, kuerzel, jetzt]);
      return antwort_({ ok: true });
    } else if (p.action === 'listFeedback') {
      return antwort_({ ok: true, feedback: feedback_() });
    } else if (p.action === 'deleteFeedback') {
      const s = blatt_('Feedback'), w = s.getDataRange().getValues();
      const i = w.findIndex((r, idx) => idx > 0 && r[0] === p.id);
      if (i > 0) s.deleteRow(i + 1);
      return antwort_({ ok: true, feedback: feedback_() });
    } else if (p.action === 'deleteRating') {
      const s = blatt_('Bewertungen'), w = s.getDataRange().getValues();
      const i = w.findIndex((r, idx) => idx > 0 && r[0] === p.id);
      if (i > 0) { papierkorb_(json_(w[i][6], [])); s.deleteRow(i + 1); }
    } else if (p.action === 'updateRating') {
      const s = blatt_('Bewertungen'), w = s.getDataRange().getValues();
      const i = w.findIndex((r, idx) => idx > 0 && r[0] === p.id);
      if (i < 1) return fehler_('Diese Bewertung gibt es nicht mehr.');
      const sterne = parseInt(p.sterne, 10);
      if (!(sterne >= 0 && sterne <= 5)) return fehler_('Bitte 0 bis 5 Sterne wählen.');
      const neu = medienSauber_(p.medien), alt = json_(w[i][6], []);
      papierkorb_(alt.filter(a => !neu.some(n => n.url === a.url)));
      s.getRange(i + 1, 4, 1, 2).setValues([[String(sterne), String(p.kommentar || '').trim().slice(0, 500)]]);
      s.getRange(i + 1, 7).setValue(JSON.stringify(neu));
    } else if (p.action === 'rate') {
      const buchId = String(p.bookId || '').slice(0, 120), kuerzel = String(p.kuerzel || '').toUpperCase(), sterne = parseInt(p.sterne, 10);
      if (!buchId || !KUERZEL.test(kuerzel)) return fehler_('Bitte dein Kürzel eintragen: 2 oder 3 Buchstaben.');
      if (!(sterne >= 0 && sterne <= 5)) return fehler_('Bitte 0 bis 5 Sterne wählen.');
      const medien = medienSauber_(p.medien);
      const zeile = [String(sterne), String(p.kommentar || '').trim().slice(0, 500), jetzt, JSON.stringify(medien)];
      const s = blatt_('Bewertungen'), w = s.getDataRange().getValues();
      const i = w.findIndex((r, idx) => idx > 0 && r[1] === buchId && r[2] === kuerzel);
      if (i > 0) { papierkorb_(json_(w[i][6], []).filter(a => !medien.some(n => n.url === a.url))); s.getRange(i + 1, 4, 1, 4).setValues([zeile]); }
      else s.appendRow([Utilities.getUuid(), buchId, kuerzel].concat(zeile));
    } else if (p.action === 'borrow') {
      const buchId = String(p.bookId || '').slice(0, 120), kuerzel = String(p.kuerzel || '').toUpperCase();
      if (!buchId || !KUERZEL.test(kuerzel)) return fehler_('Bitte dein Kürzel eintragen: 2 oder 3 Buchstaben.');
      const bestand = buecher_();
      if (bestand.length && !bestand.some(b => b.id === buchId && b.aktiv !== false)) return fehler_('Dieses Buch ist nicht (mehr) im Bestand.');
      const s = blatt_('Ausleihen');
      if (s.getDataRange().getValues().some((r, i) => i > 0 && r[1] === buchId && !r[6])) return fehler_('Dieses Buch ist gerade verliehen.');
      s.appendRow([Utilities.getUuid(), buchId, kuerzel, jetzt, plusTage_(jetzt, LEIHTAGE), 'FALSE', '']);
    } else if (p.action === 'extend' || p.action === 'return') {
      const s = blatt_('Ausleihen'), w = s.getDataRange().getValues();
      const i = w.findIndex((r, idx) => idx > 0 && r[0] === p.loanId);
      if (i < 1 || w[i][6]) return fehler_('Diese Ausleihe ist schon abgeschlossen.');
      if (p.action === 'extend') {
        if (String(w[i][5]).toUpperCase() === 'TRUE') return fehler_('Schon einmal verlängert.');
        s.getRange(i + 1, 5, 1, 2).setValues([[plusTage_(iso_(w[i][4]), LEIHTAGE), 'TRUE']]);
      } else s.getRange(i + 1, 7).setValue(jetzt);
    } else return fehler_('Unbekannte Aktion.');
    return antwort_(zustand_());
  } catch (err) {
    console.error(p.action, err);
    return fehler_('Aktion fehlgeschlagen: ' + (err && err.message ? err.message : 'unbekannter Fehler'));
  } finally {
    if (gesperrt) lock.releaseLock();
  }
}
