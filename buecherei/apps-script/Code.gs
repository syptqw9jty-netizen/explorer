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
 * Das Blatt „Ausleihen“ wird beim ersten Aufruf angelegt. Jede Zeile ist eine Ausleihe.
 * Korrekturen sind direkt in der Tabelle möglich.
 */
const BLATT = 'Ausleihen';
const KOPF = ['id', 'buchId', 'name', 'ausgeliehenAm', 'faelligAm', 'verlaengert', 'zurueckAm'];
const LEIHTAGE = 28;

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

function iso_(v) { return v instanceof Date ? v.toISOString() : String(v || ''); }

function liste_() {
  const werte = blatt_().getDataRange().getValues();
  werte.shift();
  return werte.filter(r => r[0]).map(r => ({
    id: String(r[0]),
    bookId: String(r[1]),
    name: String(r[2]),
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
  return antwort_({ ok: true, loans: liste_() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = JSON.parse(e.postData.contents || '{}');
    const s = blatt_();
    const werte = s.getDataRange().getValues();
    const jetzt = new Date().toISOString();

    if (p.action === 'borrow') {
      const buchId = String(p.bookId || '').slice(0, 120);
      const name = String(p.name || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      if (!buchId || name.length < 2) return antwort_({ ok: false, error: 'Bitte Namen eintragen.' });
      const offen = werte.some((r, i) => i > 0 && r[1] === buchId && !r[6]);
      if (offen) return antwort_({ ok: false, error: 'Dieses Buch ist gerade verliehen.' });
      s.appendRow([Utilities.getUuid(), buchId, name, jetzt, plusTage_(jetzt, LEIHTAGE), 'FALSE', '']);
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
    return antwort_({ ok: true, loans: liste_() });
  } catch (err) {
    return antwort_({ ok: false, error: 'Speichern fehlgeschlagen.' });
  } finally {
    lock.releaseLock();
  }
}
