/**
 * GAUSS Bücherei – gemeinsamer Ausleih-Speicher in Google Sheets.
 *
 * Einrichtung (einmalig, ca. 5 Minuten):
 * 1. Neue Google-Tabelle anlegen, z. B. „GAUSS Bücherei – Ausleihen“.
 * 2. Erweiterungen → Apps Script. Diesen Code einfügen, speichern.
 * 3. Bereitstellen → Neue Bereitstellung → Typ „Web-App“.
 *    Ausführen als: Ich · Zugriff: Jeder.
 * 4. Die Web-App-URL in index.html bei CONFIG.API_URL eintragen.
 *
 * Die Blätter „Ausleihen“ und „Bewertungen“ werden beim ersten Aufruf angelegt.
 * Je Buch und Kürzel gibt es eine Bewertung; erneutes Bewerten überschreibt sie.
 * Korrekturen sind direkt in der Tabelle möglich.
 */
const BLATT = 'Ausleihen';
const KOPF = ['id', 'buchId', 'kuerzel', 'ausgeliehenAm', 'faelligAm', 'verlaengert', 'zurueckAm'];
const LEIHTAGE = 28;
const BLATT_B = 'Bewertungen';
const KOPF_B = ['id', 'buchId', 'kuerzel', 'sterne', 'kommentar', 'am'];

function blatt_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(BLATT);
  if (!s) {
    s = ss.insertSheet(BLATT);
    s.getRange('A:G').setNumberFormat('@');
    s.appendRow(KOPF);
    s.setFrozenRows(1);
  }
  return s;
}

function blattB_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(BLATT_B);
  if (!s) {
    s = ss.insertSheet(BLATT_B);
    s.getRange('A:F').setNumberFormat('@');
    s.appendRow(KOPF_B);
    s.setFrozenRows(1);
  }
  return s;
}

function bewertungen_() {
  const werte = blattB_().getDataRange().getValues();
  werte.shift();
  return werte.filter(r => r[0]).map(r => ({
    id: String(r[0]), bookId: String(r[1]), kuerzel: String(r[2]),
    sterne: Math.max(0, Math.min(5, parseInt(r[3], 10) || 0)), kommentar: String(r[4] || ''), am: iso_(r[5])
  }));
}

function iso_(v) { return v instanceof Date ? v.toISOString() : String(v || ''); }

function liste_() {
  const werte = blatt_().getDataRange().getValues();
  werte.shift();
  return werte.filter(r => r[0]).map(r => ({
    id: String(r[0]),
    bookId: String(r[1]),
    kuerzel: String(r[2]),
    borrowedAt: iso_(r[3]),
    dueAt: iso_(r[4]),
    extended: r[5] === true || String(r[5]).toUpperCase() === 'TRUE',
    returnedAt: r[6] ? iso_(r[6]) : null
  }));
}

function plusTage_(isoText, n) { const d = new Date(isoText); d.setDate(d.getDate() + n); return d.toISOString(); }

function antwort_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return antwort_({ ok: true, loans: liste_(), ratings: bewertungen_() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = JSON.parse(e.postData.contents || '{}');
    const s = blatt_();
    const werte = s.getDataRange().getValues();
    const jetzt = new Date().toISOString();

    if (p.action === 'rate') {
      const buchId = String(p.bookId || '').slice(0, 120);
      const kuerzel = String(p.kuerzel || '').toUpperCase();
      const sterne = parseInt(p.sterne, 10);
      if (!buchId || !/^[A-ZÄÖÜ]{2,3}$/.test(kuerzel)) return antwort_({ ok: false, error: 'Bitte dein Kürzel eintragen: 2 oder 3 Buchstaben.' });
      if (!(sterne >= 0 && sterne <= 5)) return antwort_({ ok: false, error: 'Bitte 0 bis 5 Sterne wählen.' });
      const kommentar = String(p.kommentar || '').trim().slice(0, 500);
      const b = blattB_();
      const wb = b.getDataRange().getValues();
      const j = wb.findIndex((r, idx) => idx > 0 && r[1] === buchId && r[2] === kuerzel);
      if (j > 0) b.getRange(j + 1, 4, 1, 3).setValues([[String(sterne), kommentar, jetzt]]);
      else b.appendRow([Utilities.getUuid(), buchId, kuerzel, String(sterne), kommentar, jetzt]);
    } else if (p.action === 'borrow') {
      const buchId = String(p.bookId || '').slice(0, 120);
      const kuerzel = String(p.kuerzel || '').toUpperCase();
      if (!buchId || !/^[A-ZÄÖÜ]{2,3}$/.test(kuerzel)) return antwort_({ ok: false, error: 'Bitte dein Kürzel eintragen: 2 oder 3 Buchstaben.' });
      const offen = werte.some((r, i) => i > 0 && r[1] === buchId && !r[6]);
      if (offen) return antwort_({ ok: false, error: 'Dieses Buch ist gerade verliehen.' });
      s.appendRow([Utilities.getUuid(), buchId, kuerzel, jetzt, plusTage_(jetzt, LEIHTAGE), 'FALSE', '']);
    } else if (p.action === 'extend' || p.action === 'return') {
      const i = werte.findIndex((r, idx) => idx > 0 && r[0] === p.loanId);
      if (i < 1 || werte[i][6]) return antwort_({ ok: false, error: 'Diese Ausleihe ist schon abgeschlossen.' });
      const zeile = i + 1;
      if (p.action === 'extend') {
        if (String(werte[i][5]).toUpperCase() === 'TRUE') return antwort_({ ok: false, error: 'Schon einmal verlängert.' });
        s.getRange(zeile, 5, 1, 2).setValues([[plusTage_(iso_(werte[i][4]), LEIHTAGE), 'TRUE']]);
      } else {
        s.getRange(zeile, 7).setValue(jetzt);
      }
    } else {
      return antwort_({ ok: false, error: 'Unbekannte Aktion.' });
    }
    return antwort_({ ok: true, loans: liste_(), ratings: bewertungen_() });
  } catch (err) {
    return antwort_({ ok: false, error: 'Speichern fehlgeschlagen.' });
  } finally {
    lock.releaseLock();
  }
}
