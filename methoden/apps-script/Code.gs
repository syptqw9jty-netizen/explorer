/**
 * GAUSS Werkstatt (Methodensammlung) – gemeinsamer Speicher in Google Sheets, KI über die Anthropic-API.
 *
 * Einrichtung (einmalig, ca. 5 Minuten):
 * 1. Neue Google-Tabelle anlegen, z. B. „GAUSS Werkstatt“ (im Firmen-Workspace).
 * 2. Erweiterungen → Apps Script. Diesen Code einfügen, speichern.
 * 3. Optional für „Methode finden lassen“ und „Mit KI anwenden“:
 *    Projekteinstellungen → Skripteigenschaften → ANTHROPIC_API_KEY = API-Schlüssel (console.anthropic.com).
 *    Optional ANTHROPIC_MODEL (Standard: claude-sonnet-5-5), KI_PRO_TAG (Standard: 200 Anfragen).
 *    Ohne Schlüssel bleiben die KI-Funktionen ausgeblendet; „Prompt kopieren“ funktioniert immer.
 * 4. Bereitstellen → Neue Bereitstellung → Typ „Web-App“, Ausführen als: Ich.
 *    Zugriff: empfohlen „Jeder in <Firma>“. „Jeder“ nur, wenn Kolleg:innen ohne Google-Konto zugreifen sollen –
 *    dann sind Erfahrungen und KI öffentlich erreichbar (Tageslimit schützt das Kontingent).
 * 5. Die Web-App-URL in methoden/index.html bei CONFIG.API_URL eintragen.
 *
 * Das Blatt „Erfahrungen“ entsteht beim ersten Aufruf. Gespeichert werden nur Methode, Kürzel, ein Satz und Zeitpunkt.
 * KI-Eingaben werden nicht gespeichert.
 */
const SPALTEN = ['id', 'methode', 'kuerzel', 'satz', 'ts'];
const KUERZEL = /^[A-ZÄÖÜ]{2,3}$/;
const PROPS = PropertiesService.getScriptProperties();

function blatt_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName('Erfahrungen');
  if (!s) {
    s = ss.insertSheet('Erfahrungen');
    s.getRange(1, 1, s.getMaxRows(), SPALTEN.length).setNumberFormat('@');
    s.appendRow(SPALTEN);
    s.setFrozenRows(1);
  }
  return s;
}
function json_(t, d) { try { return JSON.parse(t); } catch (e) { return d; } }
function antwort_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function fehler_(text, code) { return antwort_({ ok: false, error: text, code: code || '' }); }

function erfahrungen_() {
  const w = blatt_().getDataRange().getValues(); w.shift();
  return w.filter(r => r[0]).map(r => ({ methode: String(r[1]), kuerzel: String(r[2]), satz: String(r[3] || ''), ts: Number(r[4]) || 0 }))
    .sort((a, b) => b.ts - a.ts).slice(0, 1000);
}
function kiAktiv_() { return !!PROPS.getProperty('ANTHROPIC_API_KEY'); }

/* ---------- KI ---------- */
function kiZaehlen_() {
  const cache = CacheService.getScriptCache();
  const tag = Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyyMMdd');
  const n = parseInt(cache.get('ki_' + tag) || '0', 10);
  if (n >= (parseInt(PROPS.getProperty('KI_PRO_TAG') || '200', 10))) return false;
  cache.put('ki_' + tag, String(n + 1), 21600);
  return true;
}
function ki_(prompt, alsJson) {
  const key = PROPS.getProperty('ANTHROPIC_API_KEY');
  const r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: PROPS.getProperty('ANTHROPIC_MODEL') || 'claude-sonnet-5-5', max_tokens: alsJson ? 800 : 2000,
      messages: [{ role: 'user', content: String(prompt).slice(0, 20000) }] })
  });
  const code = r.getResponseCode();
  if (code === 429) { const e = new Error('Gerade zu viele Anfragen.'); e.code = 'rate_limited'; throw e; }
  if (code >= 300) throw new Error('KI-Anfrage fehlgeschlagen (' + code + ').');
  const j = json_(r.getContentText(), {});
  const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  if (!alsJson) return { text: text, truncated: j.stop_reason === 'max_tokens' };
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  return { daten: a >= 0 ? json_(text.slice(a, b + 1), {}) : {} };
}

/* ---------- Web-App ---------- */
function doGet() {
  try { return antwort_({ ok: true, erfahrungen: erfahrungen_(), ki: kiAktiv_() }); }
  catch (err) { console.error('doGet', err); return fehler_('Laden fehlgeschlagen. Bitte gleich noch einmal versuchen.'); }
}

function doPost(e) {
  const p = json_((e && e.postData && e.postData.contents) || '{}', {});
  try {
    if (p.action === 'ki') {
      if (!kiAktiv_()) return fehler_('KI ist nicht eingerichtet.', 'not_granted');
      if (!kiZaehlen_()) return fehler_('Tageslimit erreicht. Morgen geht es wieder.', 'rate_limited');
      return antwort_(Object.assign({ ok: true }, ki_(p.prompt || '', !!p.json)));
    }
    if (p.action === 'erfahrung') {
      const k = String(p.kuerzel || '').toUpperCase();
      if (!KUERZEL.test(k)) return fehler_('Bitte ein Kürzel mit 2 oder 3 Buchstaben.');
      if (!/^[a-z0-9-]{2,60}$/.test(String(p.methode || ''))) return fehler_('Unbekannte Methode.');
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(20000)) return fehler_('Gerade viel los. Bitte gleich noch einmal versuchen.');
      try {
        blatt_().appendRow([Utilities.getUuid(), String(p.methode), k, String(p.satz || '').slice(0, 200), String(Date.now())]);
      } finally { lock.releaseLock(); }
      return antwort_({ ok: true, erfahrungen: erfahrungen_() });
    }
    return fehler_('Unbekannte Aktion.');
  } catch (err) {
    console.error(p.action, err);
    return fehler_(err.message || 'Das hat nicht geklappt.', err.code);
  }
}
