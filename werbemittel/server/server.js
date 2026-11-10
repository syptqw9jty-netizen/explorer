#!/usr/bin/env node
/*
 * GAUSS Werbemittel – Firmenserver
 * Ein Skript, keine Pakete, keine Installation auf den Arbeitsplätzen.
 * Liefert die App aus und speichert alle Daten auf dem Server (JSON-Dateien, tägliche Sicherung).
 *
 *   node server.js                     startet auf Port 8080
 *   PORT=80 DATEN=/srv/werbemittel node server.js
 *
 * Umgebungsvariablen (alle optional):
 *   PORT            Port, Standard 8080
 *   HOST            Netzwerkadresse, Standard 0.0.0.0 (im ganzen Firmennetz erreichbar)
 *   DATEN           Ordner für Daten, Fotos und Sicherungen, Standard ./daten neben diesem Skript
 *   APP             Ordner mit index.html, Standard: der Ordner über diesem Skript
 *   SICHERUNG_TAGE  wie viele Tagessicherungen bleiben, Standard 30
 *   DEMO=1          beim allerersten Start Demo-Daten einspielen
 *   ANTHROPIC_API_KEY, ANTHROPIC_MODEL   optional für „Mit KI ausfüllen“
 *
 * Rechte:
 *   Alle im Netz: lesen, Ausgaben und Inventuren buchen, kommentieren, eigene Buchung 24 h lang stornieren.
 *   Verwaltung (PIN): Artikel, Preise, Lieferanten, Bestellungen, Eingänge, Fotos, Einstellungen.
 */
"use strict";
const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const DATEN = path.resolve(process.env.DATEN || path.join(__dirname, "daten"));
const APP = path.resolve(process.env.APP || path.join(__dirname, ".."));
const FOTOS = path.join(DATEN, "fotos");
const SICHERUNG = path.join(DATEN, "sicherung");
const SICHERUNG_TAGE = Number(process.env.SICHERUNG_TAGE || 30);
const SAMMLUNGEN = ["artikel", "vorgaenge", "buchungen", "kommentare", "lieferanten", "bestellungen", "einstellungen"];
const NUR_VERWALTUNG = new Set(["artikel", "lieferanten", "bestellungen", "einstellungen"]);
const ID = /^[A-Za-z0-9_\-.:@+~]{1,120}$/;
const MAX_BODY = 14 * 1024 * 1024, MAX_DOC = 256 * 1024, MAX_FOTO = 10 * 1024 * 1024;
const TOKEN_MS = 12 * 3600e3, STORNO_MS = 24 * 3600e3;
const GESPERRT_FUER_APP = new Set(["server", "apps-script", ".git"]);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2" };

/* ---------- Speicher: alles im Arbeitsspeicher, je Sammlung eine JSON-Datei, atomar geschrieben ---------- */
const db = {};
const geheim = { pin: null, tokens: new Map() };
let version = Date.now();
function lesen(datei, fallback){ try { return JSON.parse(fs.readFileSync(datei, "utf8")); } catch { return fallback; } }
function laden(){
  fs.mkdirSync(FOTOS, { recursive: true }); fs.mkdirSync(SICHERUNG, { recursive: true });
  for (const c of SAMMLUNGEN) db[c] = lesen(path.join(DATEN, c + ".json"), {});
  geheim.pin = lesen(path.join(DATEN, "geheim.json"), {}).pin || null;
  const leer = SAMMLUNGEN.every(c => !Object.keys(db[c]).length);
  if (leer && process.env.DEMO === "1"){
    const demo = lesen(path.join(APP, "demo", "demo.json"), null);
    if (demo) for (const c of SAMMLUNGEN) for (const d of demo[c] || []){ const { id, ...rest } = d; db[c][id] = rest; }
    for (const c of SAMMLUNGEN) schreibenSofort(c);
    console.log("Demo-Daten eingespielt.");
  }
}
const warteschlange = new Map();
function schreibenSofort(c){
  const ziel = path.join(DATEN, c + ".json"), tmp = ziel + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db[c])); fs.renameSync(tmp, ziel);
}
function schreiben(c){
  // Schreibvorgänge je Sammlung kurz bündeln, nie parallel
  if (warteschlange.has(c)) return;
  warteschlange.set(c, setTimeout(async () => {
    warteschlange.delete(c);
    try { await sichern(); const ziel = path.join(DATEN, c + ".json"), tmp = ziel + "." + process.pid + ".tmp"; await fsp.writeFile(tmp, JSON.stringify(db[c])); await fsp.rename(tmp, ziel); }
    catch (e){ console.error("Schreiben fehlgeschlagen", c, e); }
  }, 150));
}
function geheimSchreiben(){ const z = path.join(DATEN, "geheim.json"); fs.writeFileSync(z + ".tmp", JSON.stringify({ pin: geheim.pin }), { mode: 0o600 }); fs.renameSync(z + ".tmp", z); }
let gesichertAm = "";
async function sichern(){
  const tag = new Date().toISOString().slice(0, 10); if (gesichertAm === tag) return;
  gesichertAm = tag; const ziel = path.join(SICHERUNG, tag);
  try {
    await fsp.mkdir(ziel, { recursive: true });
    for (const c of SAMMLUNGEN){ const q = path.join(DATEN, c + ".json"); if (fs.existsSync(q)) await fsp.copyFile(q, path.join(ziel, c + ".json")); }
    const alle = (await fsp.readdir(SICHERUNG)).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
    for (const alt of alle.slice(0, Math.max(0, alle.length - SICHERUNG_TAGE))) await fsp.rm(path.join(SICHERUNG, alt), { recursive: true, force: true });
  } catch (e){ console.error("Sicherung fehlgeschlagen", e); }
}

/* ---------- Live-Aktualisierung: alle offenen Fenster laden neu, sobald sich etwas ändert ---------- */
const hoerer = new Set();
function geaendert(){ version = Date.now(); for (const res of hoerer){ try { res.write(`data: ${version}\n\n`); } catch {} } }
setInterval(() => { for (const res of hoerer){ try { res.write(": ping\n\n"); } catch {} } }, 25000).unref();

/* ---------- PIN und Anmeldung ---------- */
function pinHash(pin, salz = crypto.randomBytes(16).toString("hex")){ return { salz, hash: crypto.scryptSync(String(pin), salz, 32).toString("hex") }; }
function pinPasst(pin){ if (!geheim.pin) return false; const h = crypto.scryptSync(String(pin), geheim.pin.salz, 32); return crypto.timingSafeEqual(h, Buffer.from(geheim.pin.hash, "hex")); }
function tokenNeu(){ const t = crypto.randomBytes(32).toString("hex"), bis = Date.now() + TOKEN_MS; geheim.tokens.set(t, bis); return { token: t, bis }; }
function istVerwaltung(t){ const bis = t && geheim.tokens.get(t); if (!bis) return false; if (bis < Date.now()){ geheim.tokens.delete(t); return false; } return true; }
const fehlversuche = new Map();
function gesperrt(ip){ const f = fehlversuche.get(ip); return f && f.bis > Date.now(); }
function fehlversuch(ip){ const f = fehlversuche.get(ip) || { n: 0, bis: 0 }; f.n++; if (f.n >= 5){ f.n = 0; f.bis = Date.now() + 5 * 60e3; } fehlversuche.set(ip, f); }

/* ---------- Rechte ---------- */
class Fehler extends Error { constructor(text, code = "api", status = 400){ super(text); this.code = code; this.status = status; } }
const jung = d => d && Date.now() - Date.parse(d.am || 0) < STORNO_MS;
function pruefeRecht(p, admin){
  if (admin) return;
  const { action, col, id, data } = p, alt = db[col][id];
  if (NUR_VERWALTUNG.has(col)) throw new Fehler("Das ist nur in der Verwaltung möglich.", "auth", 403);
  if (col === "kommentare") return;
  if (action === "set" && !alt && ["ausgabe", "inventur"].includes(data && data.art)) return;
  if (action === "del" && alt && alt.art !== "eingang" && jung(alt)) return;
  throw new Fehler("Das ist nur in der Verwaltung möglich.", "auth", 403);
}

/* ---------- API ---------- */
function liste(){
  const data = {};
  for (const c of SAMMLUNGEN) data[c] = Object.entries(db[c]).map(([id, d]) => {
    if (c === "einstellungen"){ const { pinHash, ...rest } = d; return { ...rest, id }; }
    return { ...d, id };
  });
  return { ok: true, server: true, version, data, ki: !!process.env.ANTHROPIC_API_KEY, pinGesetzt: !!geheim.pin };
}
async function aktion(p, ip){
  const admin = istVerwaltung(p.token);
  switch (p.action){
    case "login": {
      if (gesperrt(ip)) throw new Fehler("Zu viele Fehlversuche. Bitte in ein paar Minuten noch einmal.", "gesperrt", 429);
      if (!/^\d{4,8}$/.test(String(p.pin || ""))) throw new Fehler("Die PIN besteht aus 4 bis 8 Ziffern.");
      if (!geheim.pin){ if (!p.neu) throw new Fehler("Es ist noch keine PIN festgelegt."); geheim.pin = pinHash(p.pin); geheimSchreiben(); geaendert(); return { ok: true, ...tokenNeu() }; }
      if (!pinPasst(p.pin)){ fehlversuch(ip); throw new Fehler("PIN ist nicht richtig.", "pin", 403); }
      fehlversuche.delete(ip); return { ok: true, ...tokenNeu() };
    }
    case "logout": geheim.tokens.delete(p.token); return { ok: true };
    case "pin": {
      if (!admin) throw new Fehler("Bitte in der Verwaltung anmelden.", "auth", 401);
      if (!pinPasst(p.alt)) throw new Fehler("Die bisherige PIN ist nicht richtig.", "pin", 403);
      if (!/^\d{4,8}$/.test(String(p.neu || ""))) throw new Fehler("Die neue PIN besteht aus 4 bis 8 Ziffern.");
      geheim.pin = pinHash(p.neu); geheimSchreiben(); geheim.tokens.clear(); return { ok: true, ...tokenNeu() };
    }
    case "set": case "update": case "del": {
      if (!SAMMLUNGEN.includes(p.col)) throw new Fehler("Unbekannte Sammlung.");
      if (!ID.test(String(p.id || ""))) throw new Fehler("Ungültige Kennung.");
      pruefeRecht(p, admin);
      if (p.action === "del"){ delete db[p.col][p.id]; }
      else {
        if (!p.data || typeof p.data !== "object" || Array.isArray(p.data)) throw new Fehler("Ungültige Daten.");
        const { id, ...daten } = p.data; delete daten.pinHash;
        if (p.action === "update" && !db[p.col][p.id]) throw new Fehler("Eintrag nicht gefunden.", "nicht_gefunden", 404);
        const neu = p.action === "update" ? { ...db[p.col][p.id], ...daten } : daten;
        if (JSON.stringify(neu).length > MAX_DOC) throw new Fehler("Eintrag zu groß.");
        db[p.col][p.id] = neu;
      }
      schreiben(p.col); geaendert(); return { ok: true, version };
    }
    case "upload": {
      if (!admin) throw new Fehler("Fotos hochladen ist nur in der Verwaltung möglich.", "auth", 401);
      const m = String(p.dataUrl || "").match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
      if (!m) throw new Fehler("Nur PNG, JPEG oder WebP.");
      const bytes = Buffer.from(m[2], "base64"); if (bytes.length > MAX_FOTO) throw new Fehler("Das Foto ist zu groß.", "too_large");
      const name = crypto.randomUUID() + "." + (m[1] === "jpeg" ? "jpg" : m[1]);
      await fsp.writeFile(path.join(FOTOS, name), bytes);
      return { ok: true, id: "", url: "fotos/" + name };
    }
    case "ki": {
      if (!admin) throw new Fehler("Bitte in der Verwaltung anmelden.", "auth", 401);
      const key = process.env.ANTHROPIC_API_KEY; if (!key) throw new Fehler("KI ist nicht eingerichtet.", "not_granted");
      const inhalt = []; const m = String(p.bild || "").match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
      if (m) inhalt.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
      inhalt.push({ type: "text", text: String(p.prompt || "").slice(0, 6000) });
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 1200, messages: [{ role: "user", content: inhalt }] }) });
      if (!r.ok) throw new Fehler("KI gerade nicht erreichbar.", "unavailable", 502);
      const text = ((await r.json()).content || []).map(c => c.text || "").join(""), a = text.indexOf("{"), b = text.lastIndexOf("}");
      if (a < 0 || b < a) throw new Fehler("Die KI hat nichts Verwertbares geliefert.");
      return { ok: true, wert: JSON.parse(text.slice(a, b + 1)) };
    }
    default: throw new Fehler("Unbekannte Aktion.");
  }
}

/* ---------- HTTP ---------- */
function senden(res, status, body, typ = "application/json; charset=utf-8", extra = {}){
  res.writeHead(status, { "Content-Type": typ, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", ...extra });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
async function datei(res, wurzel, rel, req){
  const ziel = path.resolve(wurzel, "." + path.posix.normalize("/" + rel));
  if (!ziel.startsWith(wurzel + path.sep) && ziel !== wurzel) return senden(res, 404, "Nicht gefunden", "text/plain; charset=utf-8");
  if (wurzel === APP && GESPERRT_FUER_APP.has(path.relative(APP, ziel).split(path.sep)[0])) return senden(res, 404, "Nicht gefunden", "text/plain; charset=utf-8");
  try {
    const st = await fsp.stat(ziel); if (st.isDirectory()) return datei(res, wurzel, path.posix.join(rel, "index.html"), req);
    const typ = MIME[path.extname(ziel).toLowerCase()] || "application/octet-stream";
    const etag = `"${st.size.toString(16)}-${st.mtimeMs.toString(16)}"`;
    if (req.headers["if-none-match"] === etag){ res.writeHead(304); return res.end(); }
    const cache = typ.startsWith("text/html") || rel.endsWith("sw.js") ? "no-cache" : wurzel === FOTOS ? "public, max-age=31536000, immutable" : "public, max-age=3600";
    res.writeHead(200, { "Content-Type": typ, "Content-Length": st.size, "Cache-Control": cache, ETag: etag, "X-Content-Type-Options": "nosniff" });
    fs.createReadStream(ziel).pipe(res);
  } catch { senden(res, 404, "Nicht gefunden", "text/plain; charset=utf-8"); }
}
function koerper(req){
  return new Promise((ok, nein) => {
    let n = 0; const teile = [];
    req.on("data", c => { n += c.length; if (n > MAX_BODY){ nein(new Fehler("Anfrage zu groß.", "too_large", 413)); req.destroy(); } else teile.push(c); });
    req.on("end", () => ok(Buffer.concat(teile).toString("utf8"))); req.on("error", nein);
  });
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x"), ip = req.socket.remoteAddress || "";
  try {
    if (url.pathname === "/api/events"){
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
      res.write(`retry: 5000\ndata: ${version}\n\n`); hoerer.add(res); req.on("close", () => hoerer.delete(res)); return;
    }
    if (url.pathname === "/api"){
      res.setHeader("Cache-Control", "no-store");
      if (req.method === "GET") return senden(res, 200, url.searchParams.get("action") === "ping" ? { ok: true, server: true, version } : liste());
      if (req.method === "POST"){
        let p; try { p = JSON.parse(await koerper(req)); } catch (e){ throw e instanceof Fehler ? e : new Fehler("Ungültige Anfrage."); }
        return senden(res, 200, await aktion(p || {}, ip));
      }
      return senden(res, 405, { ok: false, error: "Methode nicht erlaubt." });
    }
    if (req.method !== "GET" && req.method !== "HEAD") return senden(res, 405, "Methode nicht erlaubt", "text/plain; charset=utf-8");
    if (url.pathname.startsWith("/fotos/")) return datei(res, FOTOS, decodeURIComponent(url.pathname.slice(7)), req);
    return datei(res, APP, decodeURIComponent(url.pathname), req);
  } catch (e){
    if (!(e instanceof Fehler)) console.error(e);
    senden(res, 200, { ok: false, error: e instanceof Fehler ? e.message : "Serverfehler. Bitte noch einmal versuchen.", code: e.code || "api" });
  }
});

laden();
server.listen(PORT, HOST, () => {
  const os = require("os"), adressen = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === "IPv4" && !a.internal).map(a => a.address);
  console.log(`GAUSS Werbemittel läuft.\n  Auf diesem Rechner: http://localhost:${PORT}/`);
  for (const a of adressen) console.log(`  Im Firmennetz:      http://${a}:${PORT}/`);
  console.log(`  Daten:              ${DATEN}`);
});
function beenden(){ for (const [c, t] of warteschlange){ clearTimeout(t); try { schreibenSofort(c); } catch {} } process.exit(0); }
process.on("SIGINT", beenden); process.on("SIGTERM", beenden);
