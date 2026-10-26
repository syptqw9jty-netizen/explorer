/**
 * GAUSS Bücherei – gemeinsamer Speicher in Google Sheets und Google Drive.
 *
 * Einrichtung (einmalig, ca. 5 Minuten):
 * 1. Neue Google-Tabelle anlegen, z. B. „GAUSS Bücherei“.
 * 2. Erweiterungen → Apps Script. Diesen Code einfügen, speichern.
 * 3. Optional für „Mit KI ausfüllen“: Projekteinstellungen → Skripteigenschaften →
 *    ANTHROPIC_API_KEY = dein API-Schlüssel (console.anthropic.com).
 *    Optional ANTHROPIC_MODEL (Standard: claude-sonnet-5-5).
 * 4. Bereitstellen → Neue Bereitstellung → Typ „Web-App“.
 *    Ausführen als: Ich · Zugriff: Jeder. Zugriffe auf Tabelle und Drive erlauben.
 * 5. Die Web-App-URL in index.html bei CONFIG.API_URL eintragen.
 *
 * Blätter „Buecher“, „Ausleihen“ und „Bewertungen“ entstehen beim ersten Aufruf.
 * Bilder und Videos landen im Drive-Ordner „GAUSS Bücherei Medien“ (Lesen per Link).
 * Verwaltungs-PIN: Standard 0000, gespeichert nur als Hash. Nach 5 Fehlversuchen 10 Minuten Sperre.
 */
const LEIHTAGE = 28;
const BLAETTER = {
  Buecher: ['id', 'json', 'aktualisiert'],
  Ausleihen: ['id', 'buchId', 'kuerzel', 'ausgeliehenAm', 'faelligAm', 'verlaengert', 'zurueckAm'],
  Bewertungen: ['id', 'buchId', 'kuerzel', 'sterne', 'kommentar', 'am', 'medien']
};
const KUERZEL = /^[A-ZÄÖÜ]{2,3}$/;
const MAX_MB = { bild: 8, video: 25 };
const PROPS = PropertiesService.getScriptProperties();

/* ---------- Grundlagen ---------- */
function blatt_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, 1000, BLAETTER[name].length).setNumberFormat('@');
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
function zustand_() { return { ok: true, books: buecher_(), loans: ausleihen_(), ratings: bewertungen_() }; }

/* ---------- PIN ---------- */
function hash_(pin) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'gauss-buecherei:' + pin, Utilities.Charset.UTF_8));
}
function pinPruefen_(pin) {
  const cache = CacheService.getScriptCache();
  const fehl = parseInt(cache.get('pin_fehl') || '0', 10);
  if (fehl >= 5) return 'Zu viele Versuche. Bitte in 10 Minuten erneut probieren.';
  const soll = PROPS.getProperty('ADMIN_PIN_HASH') || hash_('0000');
  if (/^\d{4}$/.test(String(pin || '')) && hash_(String(pin)) === soll) { cache.remove('pin_fehl'); return null; }
  cache.put('pin_fehl', String(fehl + 1), 600);
  return 'PIN ist nicht richtig.';
}

/* ---------- Medien in Drive ---------- */
function ordner_() {
  const id = PROPS.getProperty('MEDIEN_ORDNER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder('GAUSS Bücherei Medien');
  PROPS.setProperty('MEDIEN_ORDNER', f.getId());
  return f;
}
function medienSauber_(liste) {
  return (Array.isArray(liste) ? liste : []).slice(0, 4).filter(m => m && /^https:\/\/drive\.google\.com\//.test(m.url || ''))
    .map(m => ({ typ: m.typ === 'video' ? 'video' : 'bild', url: String(m.url), thumb: String(m.thumb || '') }));
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
function doGet() { return antwort_(zustand_()); }

function doPost(e) {
  const p = json_((e.postData && e.postData.contents) || '{}', {});
  const brauchtPin = ['checkPin', 'setPin', 'saveBook', 'deleteRating', 'analyze'].indexOf(p.action) >= 0 || (p.action === 'upload' && p.zweck === 'cover');
  if (brauchtPin) { const f = pinPruefen_(p.pin); if (f) return fehler_(f); }

  // Ohne Sperre: Prüfen, Analyse, Upload
  try {
    if (p.action === 'checkPin') return antwort_({ ok: true });
    if (p.action === 'analyze') return antwort_({ ok: true, daten: analysieren_(Array.isArray(p.bilder) ? p.bilder : []) });
    if (p.action === 'upload') {
      const typ = p.typ === 'video' ? 'video' : 'bild';
      const mime = String(p.mime || '');
      if (!(typ === 'bild' ? /^image\/(jpeg|png|webp)$/ : /^video\/(mp4|quicktime|webm)$/).test(mime)) return fehler_('Dateiformat wird nicht unterstützt.');
      const bytes = Utilities.base64Decode(String(p.data || ''));
      if (!bytes.length || bytes.length > MAX_MB[typ] * 1048576) return fehler_('Die Datei ist zu groß.');
      const datei = ordner_().createFile(Utilities.newBlob(bytes, mime, (p.zweck || 'medium') + '-' + Date.now()));
      datei.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const id = datei.getId();
      return antwort_({ ok: true, medium: {
        typ: typ,
        url: typ === 'video' ? 'https://drive.google.com/file/d/' + id + '/preview' : 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600',
        thumb: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w320'
      } });
    }
  } catch (err) { return fehler_(err.message || 'Aktion fehlgeschlagen.'); }

  // Schreibende Aktionen nacheinander
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const jetzt = new Date().toISOString();
    if (p.action === 'setPin') {
      if (!/^\d{4}$/.test(String(p.neu || ''))) return fehler_('Die neue PIN braucht vier Ziffern.');
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
    } else if (p.action === 'deleteRating') {
      const s = blatt_('Bewertungen'), w = s.getDataRange().getValues();
      const i = w.findIndex((r, idx) => idx > 0 && r[0] === p.id);
      if (i > 0) s.deleteRow(i + 1);
    } else if (p.action === 'rate') {
      const buchId = String(p.bookId || '').slice(0, 120), kuerzel = String(p.kuerzel || '').toUpperCase(), sterne = parseInt(p.sterne, 10);
      if (!buchId || !KUERZEL.test(kuerzel)) return fehler_('Bitte dein Kürzel eintragen: 2 oder 3 Buchstaben.');
      if (!(sterne >= 0 && sterne <= 5)) return fehler_('Bitte 0 bis 5 Sterne wählen.');
      const zeile = [String(sterne), String(p.kommentar || '').trim().slice(0, 500), jetzt, JSON.stringify(medienSauber_(p.medien))];
      const s = blatt_('Bewertungen'), w = s.getDataRange().getValues();
      const i = w.findIndex((r, idx) => idx > 0 && r[1] === buchId && r[2] === kuerzel);
      if (i > 0) s.getRange(i + 1, 4, 1, 4).setValues([zeile]); else s.appendRow([Utilities.getUuid(), buchId, kuerzel].concat(zeile));
    } else if (p.action === 'borrow') {
      const buchId = String(p.bookId || '').slice(0, 120), kuerzel = String(p.kuerzel || '').toUpperCase();
      if (!buchId || !KUERZEL.test(kuerzel)) return fehler_('Bitte dein Kürzel eintragen: 2 oder 3 Buchstaben.');
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
    return fehler_('Speichern fehlgeschlagen.');
  } finally {
    lock.releaseLock();
  }
}
