/*
 * Ablage: hält einen normalen Ordner und eine Excel-Datei synchron zur App – wie ein kleines lokales CMS.
 *
 *   Werbemittel/                     ← ORDNER
 *   ├─ Werbemittel.xlsx              Bestand, Ausgaben, Eingänge, Bestellungen; rosa Spalten sind bearbeitbar
 *   ├─ Artikel/<Kategorie>/<Name>/   Artikel.txt (Steckbrief, bearbeitbar), Fotos/, beliebige Dateien
 *   ├─ Lieferanten/<Name>/           Lieferant.txt, Verträge, Preislisten …
 *   ├─ Bestellungen/<Jahr>/<Nr Lieferant>/   Bestellung.txt, Angebot, Auftragsbestätigung …
 *   ├─ Eingänge/<Jahr>/<Datum Lieferant>/    Eingang.txt, Rechnung, Lieferschein …
 *   └─ System/                       App und Server, nicht anfassen
 *
 * App → Ordner: nach jeder Änderung (gebündelt) werden Steckbriefe, Fotos und die Excel-Datei geschrieben.
 * Ordner → App: alle paar Sekunden wird geprüft, ob jemand Steckbriefe geändert, Ordner verschoben/umbenannt,
 * neue Artikelordner angelegt, Dateien/Fotos abgelegt oder die Excel-Datei gespeichert hat.
 * Polling statt fs.watch, weil Netzlaufwerke (SMB) Änderungsmeldungen oft verschlucken.
 */
"use strict";
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { schreibeXlsx, leseXlsx } = require("./xlsx");

const KATEGORIEN = ["Werbeartikel", "Drucksachen", "Textilien", "Messe & Event", "Sonstiges"];
const BEREICHE = ["GAUSS", "SoPart", "Kommunal", "Justiz", "Sozial", "Neutral"];
const BILD = /\.(png|jpe?g|webp|svg|gif)$/i;
const STECKBRIEF = "Artikel.txt";
const hash = s => crypto.createHash("sha1").update(s).digest("hex");
const sauber = s => String(s || "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").replace(/^[\s.]+|[\s.]+$/g, "").slice(0, 80) || "Ohne Namen";
const zahlDe = n => Number(n || 0).toLocaleString("de-DE");
const euroDe = n => Number(n) ? Number(n).toFixed(2).replace(".", ",") : "";
const parseZahl = s => { if (typeof s === "number") return s; const t = String(s ?? "").replace(/[^\d,.-]/g, ""); if (!t) return NaN; const n = parseFloat(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); return isFinite(n) ? n : NaN; };
const bereich = a => a.marke === "GAUSS LVS" ? "GAUSS" : (a.marke || "");
const heute = () => new Date().toISOString().slice(0, 10);
const istVersteckt = n => /^[._~]/.test(n) || /^(desktop\.ini|thumbs\.db)$/i.test(n) || n.startsWith("~$");

module.exports = function ablage({ db, ORDNER, APP, FOTOS, DATEN, aendern, log = console.log }){
  const ZUSTAND = path.join(DATEN, "ablage.json");
  const z = Object.assign({ ordner: {}, txt: {}, xlsx: "", export: {}, fotos: {}, gesehen: {} }, (() => { try { return JSON.parse(fs.readFileSync(ZUSTAND, "utf8")); } catch { return {}; } })());
  const zSichern = () => { try { fs.writeFileSync(ZUSTAND + ".tmp", JSON.stringify(z)); fs.renameSync(ZUSTAND + ".tmp", ZUSTAND); } catch (e){ log("Ablage: Zustand nicht gespeichert", e.message); } };
  const abs = rel => path.join(ORDNER, ...rel.split("/"));
  const relVon = p => path.relative(ORDNER, p).split(path.sep).join("/");
  const existiert = p => { try { fs.statSync(p); return true; } catch { return false; } };
  const status = { aktiv: true, ordner: ORDNER, excel: "", fehler: "", zuletzt: "" };
  for (const d of ["Artikel", "Lieferanten", "Bestellungen", "Eingänge", ...KATEGORIEN.map(k => "Artikel/" + sauber(k))]) fs.mkdirSync(abs(d), { recursive: true });

  /* ---------- Bestand ---------- */
  function bestaende(){
    const sum = new Map(), je = new Map();
    for (const b of Object.values(db.buchungen)){ const m = Number(b.menge || 0); sum.set(b.artikelId, (sum.get(b.artikelId) || 0) + m); const k = b.artikelId + "|" + (b.variante || ""); je.set(k, (je.get(k) || 0) + m); }
    return { gesamt: id => sum.get(id) || 0, variante: (id, v) => je.get(id + "|" + (v || "")) || 0 };
  }

  /* ---------- Wohin gehört ein Eintrag? ---------- */
  function wunschPfad(art, id, d, belegt){
    let basis;
    if (art === "artikel") basis = `Artikel/${sauber(KATEGORIEN.includes(d.kategorie) ? d.kategorie : "Sonstiges")}/${sauber(d.name)}`;
    else if (art === "lieferanten") basis = `Lieferanten/${sauber(d.name)}`;
    else if (art === "bestellungen") basis = `Bestellungen/${String(d.angelegt || heute()).slice(0, 4)}/${sauber([d.nr, d.lieferant].filter(Boolean).join(" "))}`;
    else basis = `Eingänge/${String(d.datum || heute()).slice(0, 4)}/${sauber([d.datum, d.lieferant, d.bestellnr].filter(Boolean).join(" "))}`;
    let p = basis, i = 2; while (belegt.has(p.toLowerCase())) p = `${basis} (${i++})`;
    belegt.add(p.toLowerCase()); return p;
  }
  function eintraege(){
    const l = [];
    for (const [id, d] of Object.entries(db.artikel)) l.push(["artikel", id, d]);
    for (const [id, d] of Object.entries(db.lieferanten)) l.push(["lieferanten", id, d]);
    for (const [id, d] of Object.entries(db.bestellungen)) if (d.status !== "entwurf") l.push(["bestellungen", id, d]);
    for (const [id, d] of Object.entries(db.vorgaenge)) if (d.art === "eingang") l.push(["eingang", id, d]);
    return l;
  }

  /* ---------- Steckbriefe ---------- */
  const FELDER = [
    ["Kategorie", a => a.kategorie], ["Bereich", a => bereich(a)], ["Lagerort", a => a.lagerort], ["Einheit", a => a.einheit || "Stück"],
    ["Meldebestand", a => a.mindest || ""], ["Nachbestellen", a => a.nbModus === "aus" ? "nein" : "ja"],
    ["Regel", a => (a.nbRegel || (a.bestellmenge ? "fest" : "auffuellen")) === "fest" ? "feste Menge" : "auffüllen"],
    ["Zielbestand", a => a.zielbestand || ""], ["Feste Menge", a => a.bestellmenge || ""], ["Bestellschritt", a => a.vpe || ""],
    ["Lieferant", a => a.lieferant], ["Artikelnummer", a => a.artikelnr], ["Einkaufspreis netto", a => euroDe(a.ek)],
    ["Kostenstelle", a => a.kostenstelle], ["Sachkonto", a => a.sachkonto]
  ];
  function artikelTxt(id, a, B){
    const v = (a.varianten || []).map(x => `${x} ${zahlDe(B.variante(id, x))}`).join(" · ");
    return `# ${a.name}\n\n${FELDER.map(([k, f]) => `${k}: ${f(a) ?? ""}`).join("\n")}\n\n## Beschreibung\n\n${a.beschreibung || ""}\n\n## Interne Notiz\n\n${a.notiz || ""}\n\n---\n`
      + `Bestand: ${zahlDe(B.gesamt(id))} ${a.einheit || "Stück"}${v ? ` (${v})` : ""}${a.aktiv === false ? " · archiviert" : ""}\n`
      + `ID: ${id}\n\nDiese Datei gehört zur App Werbemittel. Alles über der Linie darf geändert werden, die App übernimmt es nach wenigen Sekunden.\nBestand ändert sich nur über Buchungen in der App oder die Spalte „Gezählt“ in Werbemittel.xlsx. Dateien in diesem Ordner erscheinen in der App beim Artikel.\n`;
  }
  function leseTxt(text){
    const r = { felder: {} }, zeilen = text.replace(/^﻿/, "").split(/\r?\n/);
    let abschnitt = "", puffer = { Beschreibung: [], "Interne Notiz": [] };
    for (const z of zeilen){
      if (/^---\s*$/.test(z)){ abschnitt = "ende"; continue; }
      const id = z.match(/^ID:\s*(\S+)/); if (id){ r.id = id[1]; continue; }
      if (abschnitt === "ende") continue;
      const h1 = z.match(/^#\s+(.+)/); if (h1 && !abschnitt){ r.name = h1[1].trim(); continue; }
      const h2 = z.match(/^##\s+(.+)/); if (h2){ abschnitt = h2[1].trim(); continue; }
      if (abschnitt){ (puffer[abschnitt] ||= []).push(z); continue; }
      const f = z.match(/^([^:]{2,40}):\s*(.*)$/); if (f) r.felder[f[1].trim()] = f[2].trim();
    }
    r.beschreibung = puffer.Beschreibung.join("\n").trim(); r.notiz = puffer["Interne Notiz"].join("\n").trim();
    return r;
  }
  function txtNachArtikel(t, a){
    const f = t.felder, d = {};
    const setze = (k, w) => { if (w !== undefined && JSON.stringify(w) !== JSON.stringify(a[k] ?? (typeof w === "number" ? 0 : ""))) d[k] = w; };
    const nummer = k => { if (!(k in f)) return undefined; const n = parseZahl(f[k]); return isFinite(n) ? Math.max(0, Math.round(n)) : 0; };
    if (t.name) setze("name", t.name);
    if (KATEGORIEN.includes(f.Kategorie)) setze("kategorie", f.Kategorie);
    if ("Bereich" in f){ const b = BEREICHE.find(x => x.toLowerCase() === f.Bereich.toLowerCase()); if (b && b !== bereich(a)) d.marke = b; }
    for (const [k, feld] of [["Lagerort", "lagerort"], ["Einheit", "einheit"], ["Lieferant", "lieferant"], ["Artikelnummer", "artikelnr"], ["Kostenstelle", "kostenstelle"], ["Sachkonto", "sachkonto"]]) if (k in f) setze(feld, f[k]);
    setze("mindest", nummer("Meldebestand")); setze("zielbestand", nummer("Zielbestand")); setze("bestellmenge", nummer("Feste Menge")); setze("vpe", nummer("Bestellschritt"));
    if ("Nachbestellen" in f) setze("nbModus", /^(nein|aus|0|false)$/i.test(f.Nachbestellen) ? "aus" : "");
    if ("Regel" in f) setze("nbRegel", /fest/i.test(f.Regel) ? "fest" : "auffuellen");
    if ("Einkaufspreis netto" in f){ const n = parseZahl(f["Einkaufspreis netto"]); setze("ek", isFinite(n) ? Math.round(n * 100) / 100 : 0); }
    setze("beschreibung", t.beschreibung); setze("notiz", t.notiz);
    return d;
  }
  const lieferantTxt = (id, l) => `# ${l.name}\n\nAnsprechpartner: ${l.ansprechpartner || ""}\nE-Mail: ${l.email || ""}\nTelefon: ${l.telefon || ""}\nKundennummer: ${l.kundennr || ""}\nShop: ${l.shopUrl || ""}\nLieferzeit: ${l.lieferzeitTage ? l.lieferzeitTage + " Tage" : ""}\n\n${l.notiz || ""}\n\n---\nID: ${id}\nWird von der App geschrieben; Änderungen bitte in der App. Verträge, Preislisten und Angebote einfach in diesen Ordner legen.\n`;
  const artName = id => db.artikel[id]?.name || "Gelöschter Artikel";
  const bestellungTxt = (id, b) => `# Bestellung ${b.nr || ""}\n\nLieferant: ${b.lieferant || ""}\nStatus: ${b.status || ""}\nBestellt am: ${String(b.bestellt || b.angelegt || "").slice(0, 10)}\n\n${(b.positionen || []).map(p => `- ${zahlDe(p.menge)} × ${artName(p.artikelId)}${p.variante ? " " + p.variante : ""}${p.ek ? ` à ${euroDe(p.ek)} €` : ""}`).join("\n")}\n\n${b.notiz || ""}\n\n---\nID: ${id}\nWird von der App geschrieben. Angebot, Auftragsbestätigung, Lieferschein und Rechnung einfach in diesen Ordner legen.\n`;
  const eingangTxt = (id, v) => `# Eingang ${v.datum || ""}\n\nLieferant: ${v.lieferant || ""}\nBestellnummer: ${v.bestellnr || ""}\nRechnungsnummer: ${v.rechnungsnr || ""}\nBetrag netto: ${euroDe(v.betrag)}\nRechnung: ${v.rechnung || ""}\nGebucht von: ${v.kuerzel || ""}\n\n${Object.values(db.buchungen).filter(b => b.vorgangId === id).map(b => `- ${zahlDe(b.menge)} × ${artName(b.artikelId)}${b.variante ? " " + b.variante : ""}`).join("\n")}\n\n${v.notiz || ""}\n\n---\nID: ${id}\nWird von der App geschrieben. Rechnung und Lieferschein einfach in diesen Ordner legen.\n`;
  const TXTNAME = { artikel: STECKBRIEF, lieferanten: "Lieferant.txt", bestellungen: "Bestellung.txt", eingang: "Eingang.txt" };

  async function schreibeWennAnders(rel, inhalt){
    const p = abs(rel); let alt = null; try { alt = await fsp.readFile(p, "utf8"); } catch {}
    if (alt !== null && alt.replace(/^﻿/, "") === inhalt){ z.txt[rel] = hash(alt); return; }
    const mitBom = "﻿" + inhalt; // BOM, damit der Windows-Editor Umlaute sicher erkennt
    await fsp.writeFile(p, mitBom, "utf8"); z.txt[rel] = hash(mitBom);
  }

  /* ---------- App → Ordner ---------- */
  async function exportieren(){
    const B = bestaende(), belegt = new Set(), aktiv = new Set();
    for (const [art, id, d] of eintraege()){
      const key = art + ":" + id; aktiv.add(key);
      const wunsch = wunschPfad(art, id, d, belegt), alt = z.ordner[key];
      if (alt && alt !== wunsch && existiert(abs(alt)) && !existiert(abs(wunsch))){
        await fsp.mkdir(path.dirname(abs(wunsch)), { recursive: true });
        try { await fsp.rename(abs(alt), abs(wunsch)); for (const k of Object.keys(z.txt)) if (k.startsWith(alt + "/")){ z.txt[wunsch + k.slice(alt.length)] = z.txt[k]; delete z.txt[k]; } }
        catch (e){ status.fehler = `Ordner „${alt}“ ist gerade geöffnet und konnte nicht umbenannt werden.`; z.ordner[key] = alt; continue; }
      }
      z.ordner[key] = wunsch;
      await fsp.mkdir(abs(art === "artikel" ? wunsch + "/Fotos" : wunsch), { recursive: true });
      const txt = art === "artikel" ? artikelTxt(id, d, B) : art === "lieferanten" ? lieferantTxt(id, d) : art === "bestellungen" ? bestellungTxt(id, d) : eingangTxt(id, d);
      await schreibeWennAnders(wunsch + "/" + TXTNAME[art], txt);
      if (art === "artikel") await fotosExportieren(id, d, wunsch);
    }
    // Gelöschte Einträge: Ordner nicht löschen, sondern nach _Gelöscht verschieben
    for (const key of Object.keys(z.ordner)) if (!aktiv.has(key)){
      const alt = z.ordner[key]; delete z.ordner[key];
      if (!existiert(abs(alt))) continue;
      const ziel = `${alt.split("/")[0]}/_Gelöscht/${path.posix.basename(alt)} ${new Date().toISOString().slice(0, 10)}`;
      try { await fsp.mkdir(path.dirname(abs(ziel)), { recursive: true }); await fsp.rename(abs(alt), abs(ziel)); } catch {}
    }
    await excelSchreiben(B);
    zSichern();
  }
  async function fotosExportieren(id, a, rel){
    const liste = z.fotos[id] ||= {}; let i = 0;
    for (const f of a.fotos || []){
      i++; const url = String(f.url || "");
      if (!url || url.startsWith("ablage/")) continue;
      if (liste[url]) continue; // schon einmal exportiert (auch wenn jemand die Datei danach gelöscht hat, siehe Import)
      const quelle = url.startsWith("fotos/") ? path.join(FOTOS, path.basename(url)) : url.startsWith("demo/") ? path.join(APP, "demo", path.basename(url)) : null;
      if (!quelle || !existiert(quelle)) continue;
      const name = `${String(i).padStart(2, "0")} ${path.basename(url)}`;
      await fsp.mkdir(abs(rel + "/Fotos"), { recursive: true });
      await fsp.copyFile(quelle, abs(rel + "/Fotos/" + name)); liste[url] = name;
    }
  }

  /* ---------- Excel ---------- */
  const SP = {
    artikel: [
      { titel: "ID", breite: 22 }, { titel: "Bezeichnung", breite: 34, bearbeitbar: true }, { titel: "Kategorie", breite: 15, bearbeitbar: true }, { titel: "Bereich", breite: 11, bearbeitbar: true },
      { titel: "Lagerort", breite: 26, bearbeitbar: true }, { titel: "Einheit", breite: 9, bearbeitbar: true }, { titel: "Bestand", breite: 10 }, { titel: "Gezählt", breite: 10, bearbeitbar: true },
      { titel: "Meldebestand", breite: 13, bearbeitbar: true }, { titel: "Nachbestellen", breite: 13, bearbeitbar: true }, { titel: "Regel", breite: 13, bearbeitbar: true },
      { titel: "Zielbestand", breite: 12, bearbeitbar: true }, { titel: "Feste Menge", breite: 12, bearbeitbar: true }, { titel: "Bestellschritt", breite: 13, bearbeitbar: true },
      { titel: "Lieferant", breite: 24, bearbeitbar: true }, { titel: "Artikelnummer", breite: 15, bearbeitbar: true }, { titel: "EK netto", breite: 11, bearbeitbar: true, format: "euro" },
      { titel: "Bestandswert", breite: 13, format: "euro" }, { titel: "Kostenstelle", breite: 15, bearbeitbar: true }, { titel: "Sachkonto", breite: 18, bearbeitbar: true },
      { titel: "Beschreibung", breite: 50, bearbeitbar: true }, { titel: "Ordner", breite: 44 }, { titel: "Aktiv", breite: 8 }
    ],
    groessen: [{ titel: "ID", breite: 22 }, { titel: "Artikel", breite: 34 }, { titel: "Größe/Variante", breite: 15 }, { titel: "Bestand", breite: 10 }, { titel: "Gezählt", breite: 10, bearbeitbar: true }]
  };
  async function excelSchreiben(B){
    const art = Object.entries(db.artikel).sort((x, y) => String(x[1].name).localeCompare(String(y[1].name), "de"));
    const zeilenA = art.map(([id, a]) => { const n = B.gesamt(id), r = a.nbRegel || (a.bestellmenge ? "fest" : "auffuellen");
      return [id, a.name, a.kategorie, bereich(a), a.lagerort, a.einheit || "Stück", n, "", a.mindest || "", a.nbModus === "aus" ? "nein" : "ja", r === "fest" ? "feste Menge" : "auffüllen",
        a.zielbestand || "", a.bestellmenge || "", a.vpe || "", a.lieferant, a.artikelnr, Number(a.ek) || "", Number(a.ek) && n > 0 ? Math.round(a.ek * n * 100) / 100 : "", a.kostenstelle, a.sachkonto,
        a.beschreibung, z.ordner["artikel:" + id] || "", a.aktiv === false ? "nein" : "ja"]; });
    const zeilenG = []; for (const [id, a] of art) for (const v of a.varianten || []) zeilenG.push([id, a.name, v, B.variante(id, v), ""]);
    const vg = Object.entries(db.vorgaenge), bu = Object.values(db.buchungen);
    const pos = (vid) => bu.filter(b => b.vorgangId === vid);
    const ausgaben = [], eingaenge = [];
    for (const [vid, v] of vg.sort((x, y) => String(y[1].datum).localeCompare(String(x[1].datum)))){
      for (const b of pos(vid)){
        const m = Math.abs(Number(b.menge || 0)), ek = Number(b.ek) || "";
        if (v.art === "ausgabe") ausgaben.push([v.datum, v.an, v.anlass, v.kostenstelle || b.kostenstelle, artName(b.artikelId), b.variante, m, ek, ek ? Math.round(ek * m * 100) / 100 : "", v.kuerzel, v.geschaetzt ? "geschätzt" : ""]);
        if (v.art === "eingang") eingaenge.push([v.datum, v.lieferant, v.bestellnr, v.rechnungsnr, v.betrag || "", v.rechnung, artName(b.artikelId), b.variante, m, ek, v.kuerzel, z.ordner["eingang:" + vid] || ""]);
      }
    }
    const bestellungen = []; for (const [id, b] of Object.entries(db.bestellungen)) for (const p of b.positionen || []) bestellungen.push([b.nr, b.lieferant, b.status, String(b.bestellt || b.angelegt || "").slice(0, 10), artName(p.artikelId), p.variante, Number(p.menge) || 0, Number(p.ek) || "", z.ordner["bestellungen:" + id] || ""]);
    const lieferanten = Object.values(db.lieferanten).map(l => [l.name, l.ansprechpartner, l.email, l.telefon, l.kundennr, l.bestellweg, l.lieferzeitTage || ""]);
    const blaetter = [
      { name: "Artikel", spalten: SP.artikel, zeilen: zeilenA },
      { name: "Größen", spalten: SP.groessen, zeilen: zeilenG },
      { name: "Ausgaben", spalten: ["Datum", "An", "Wofür", "Kostenstelle", "Artikel", "Größe", "Menge", "EK netto", "Wert netto", "Kürzel", "Hinweis"].map((t, i) => ({ titel: t, breite: [11, 28, 26, 16, 32, 8, 8, 10, 11, 8, 10][i], format: i === 7 || i === 8 ? "euro" : "" })), zeilen: ausgaben },
      { name: "Eingänge", spalten: ["Datum", "Lieferant", "Bestellnr.", "Rechnungsnr.", "Betrag netto", "Rechnung", "Artikel", "Größe", "Menge", "EK netto", "Kürzel", "Ordner"].map((t, i) => ({ titel: t, breite: [11, 24, 13, 14, 12, 10, 32, 8, 8, 10, 8, 44][i], format: i === 4 || i === 9 ? "euro" : "" })), zeilen: eingaenge },
      { name: "Bestellungen", spalten: ["Nr.", "Lieferant", "Status", "Datum", "Artikel", "Größe", "Menge", "EK netto", "Ordner"].map((t, i) => ({ titel: t, breite: [12, 24, 11, 11, 32, 8, 8, 10, 44][i], format: i === 7 ? "euro" : "" })), zeilen: bestellungen },
      { name: "Lieferanten", spalten: ["Name", "Ansprechpartner", "E-Mail", "Telefon", "Kundennr.", "Bestellweg", "Lieferzeit Tage"].map(t => ({ titel: t, breite: 20 })), zeilen: lieferanten },
      { name: "Hinweise", filter: false, spalten: [{ titel: "So funktioniert diese Datei", breite: 110 }], zeilen: [
        ["Die App Werbemittel schreibt diese Datei nach jeder Änderung neu. Sie ist immer auf dem aktuellen Stand."],
        ["Rosa Spalten in „Artikel“ und „Größen“ dürfen geändert werden. Nach dem Speichern übernimmt die App die Werte nach wenigen Sekunden."],
        ["Bestand zählen: Zahl in „Gezählt“ eintragen und speichern. Die App bucht die Differenz als Inventur (Kürzel XLS) und leert die Spalte wieder."],
        ["Neuer Artikel: unten eine Zeile mit Bezeichnung und Kategorie ergänzen, ID leer lassen. Die App legt Artikel und Ordner an."],
        ["Graue Spalten werden berechnet; Änderungen daran gehen beim nächsten Schreiben verloren. Ausgaben und Eingänge bitte in der App buchen."],
        ["Solange die Datei in Excel geöffnet ist, kann die App sie nicht überschreiben. Sie versucht es nach dem Schließen automatisch erneut."]
      ] }
    ];
    const daten = JSON.stringify(blaetter.map(b => b.zeilen));
    const ziel = abs("Werbemittel.xlsx");
    if (daten === z.export.xlsxDaten && existiert(ziel)) return;
    const buf = schreibeXlsx(blaetter);
    try { await fsp.writeFile(ziel + ".tmp", buf); await fsp.rename(ziel + ".tmp", ziel); z.xlsx = hash(buf); z.export.xlsxDaten = daten; status.excel = "aktuell"; }
    catch (e){ try { await fsp.rm(ziel + ".tmp", { force: true }); } catch {} status.excel = "geöffnet"; status.fehler = "Werbemittel.xlsx ist gerade geöffnet. Die App schreibt sie nach dem Schließen neu."; }
  }
  async function excelLesen(){
    const ziel = abs("Werbemittel.xlsx"); let buf; try { buf = await fsp.readFile(ziel); } catch { return false; }
    const h = hash(buf); if (h === z.xlsx) return false;
    let mappe; try { mappe = leseXlsx(buf); } catch (e){ status.fehler = "Werbemittel.xlsx konnte nicht gelesen werden: " + e.message; z.xlsx = h; return false; }
    z.xlsx = h; z.export.xlsxDaten = ""; let n = 0;
    const B = bestaende(), zaehlung = [];
    const blatt = (name, sp) => { const rows = mappe[name] || [], kopf = (rows[0] || []).map(x => String(x).trim()); const idx = t => kopf.indexOf(t); return { rows: rows.slice(1), idx, sp }; };
    const A = blatt("Artikel"), wert = (r, t) => { const i = A.idx(t); return i < 0 ? undefined : r[i]; };
    for (const r of A.rows){
      const id = String(wert(r, "ID") ?? "").trim(), name = String(wert(r, "Bezeichnung") ?? "").trim();
      if (!id && !name) continue;
      const alt = id ? db.artikel[id] : null;
      if (id && !alt) continue;
      const f = {}; for (const [t, k] of [["Kategorie", "Kategorie"], ["Bereich", "Bereich"], ["Lagerort", "Lagerort"], ["Einheit", "Einheit"], ["Meldebestand", "Meldebestand"], ["Nachbestellen", "Nachbestellen"], ["Regel", "Regel"], ["Zielbestand", "Zielbestand"], ["Feste Menge", "Feste Menge"], ["Bestellschritt", "Bestellschritt"], ["Lieferant", "Lieferant"], ["Artikelnummer", "Artikelnummer"], ["Kostenstelle", "Kostenstelle"], ["Sachkonto", "Sachkonto"]]){ const w = wert(r, t); if (w !== undefined) f[k] = String(w ?? "").trim(); }
      const ek = wert(r, "EK netto"); if (ek !== undefined) f["Einkaufspreis netto"] = typeof ek === "number" ? String(ek).replace(".", ",") : String(ek);
      const besch = wert(r, "Beschreibung");
      const t = { name, felder: f, beschreibung: besch === undefined ? (alt?.beschreibung || "") : String(besch ?? "").trim(), notiz: alt?.notiz || "" };
      if (alt){ const d = txtNachArtikel(t, alt); if (Object.keys(d).length){ aendern("artikel", id, { ...alt, ...d, geaendert: new Date().toISOString() }); n++; } }
      else {
        const nid = "x" + crypto.randomBytes(8).toString("hex"), jetzt = new Date().toISOString();
        const neu = { name, beschreibung: "", fotos: [], kategorie: "Sonstiges", marke: "GAUSS", varianten: [], einheit: "Stück", mindest: 0, lagerort: "", lieferant: "", artikelnr: "", notiz: "", ek: 0, mwst: 19, sachkonto: "", kostenstelle: "Marketing", shop: { aktiv: false, preis: 0, max: 0 }, aktiv: true, angelegt: jetzt, geaendert: jetzt };
        Object.assign(neu, txtNachArtikel(t, neu)); aendern("artikel", nid, neu); n++;
        const g = parseZahl(wert(r, "Gezählt")); if (isFinite(g)) zaehlung.push({ id: nid, v: "", soll: g });
        continue;
      }
      const g = parseZahl(wert(r, "Gezählt")); if (isFinite(g) && !(alt.varianten || []).length) zaehlung.push({ id, v: "", soll: g });
    }
    const G = blatt("Größen");
    for (const r of G.rows){ const id = String(r[G.idx("ID")] ?? "").trim(), v = String(r[G.idx("Größe/Variante")] ?? "").trim(), g = parseZahl(r[G.idx("Gezählt")]); if (db.artikel[id] && isFinite(g)) zaehlung.push({ id, v, soll: g }); }
    const diffs = zaehlung.map(x => ({ ...x, d: Math.round(x.soll) - (x.v ? B.variante(x.id, x.v) : B.gesamt(x.id)) })).filter(x => x.d !== 0);
    if (diffs.length){
      const vid = "x" + crypto.randomBytes(8).toString("hex"), am = new Date().toISOString(), datum = heute();
      aendern("vorgaenge", vid, { art: "inventur", an: "Inventur aus Excel", datum, am, kuerzel: "XLS", notiz: "Gezählt in Werbemittel.xlsx", geschaetzt: false });
      for (const x of diffs){ const a = db.artikel[x.id] || {}; aendern("buchungen", "x" + crypto.randomBytes(8).toString("hex"), { vorgangId: vid, artikelId: x.id, variante: x.v, menge: x.d, art: "inventur", datum, am, ek: Number(a.ek) || 0, kostenstelle: a.kostenstelle || "", geschaetzt: false }); }
      n++;
    }
    if (n) log(`Ablage: ${n} Änderung(en) aus Werbemittel.xlsx übernommen.`);
    return true; // immer neu schreiben, damit „Gezählt“ geleert und Werte normalisiert werden
  }

  /* ---------- Ordner → App ---------- */
  async function dateienIn(rel, tiefe = 0){
    let l = []; let ents; try { ents = await fsp.readdir(abs(rel), { withFileTypes: true }); } catch { return l; }
    for (const e of ents){
      if (istVersteckt(e.name)) continue;
      const r = rel + "/" + e.name;
      if (e.isDirectory()){ if (tiefe < 2) l = l.concat(await dateienIn(r, tiefe + 1)); continue; }
      if (tiefe === 0 && /^(Artikel|Lieferant|Bestellung|Eingang)\.txt$/i.test(e.name)) continue;
      try { const st = await fsp.stat(abs(r)); l.push({ name: e.name, pfad: r, groesse: st.size, geaendert: st.mtime.toISOString() }); } catch {}
    }
    return l.sort((a, b) => a.pfad.localeCompare(b.pfad, "de"));
  }
  async function unterordner(rel){ try { return (await fsp.readdir(abs(rel), { withFileTypes: true })).filter(e => e.isDirectory() && !istVersteckt(e.name)).map(e => e.name); } catch { return []; } }
  async function scannen(){
    let geaendert = false;
    const idZuPfad = new Map(), gefunden = new Map();
    // 1. Artikelordner: Artikel/<Kategorie>/<Name>
    for (const kat of await unterordner("Artikel")){
      for (const name of await unterordner("Artikel/" + kat)){
        const rel = `Artikel/${kat}/${name}`, txtRel = rel + "/" + STECKBRIEF;
        let text = null; try { text = await fsp.readFile(abs(txtRel), "utf8"); } catch {}
        if (text === null){
          // Neuer Ordner ohne Steckbrief: erst anlegen, wenn er zwei Durchläufe lang gleich heißt (Explorer legt „Neuer Ordner“ an und benennt dann um)
          if (/^neuer ordner/i.test(name) || /^new folder/i.test(name)) continue;
          if (!z.gesehen[rel]){ z.gesehen[rel] = Date.now(); continue; }
          delete z.gesehen[rel];
          const id = "x" + crypto.randomBytes(8).toString("hex"), jetzt = new Date().toISOString();
          aendern("artikel", id, { name, beschreibung: "", fotos: [], kategorie: KATEGORIEN.includes(kat) ? kat : "Sonstiges", marke: "GAUSS", varianten: [], einheit: "Stück", mindest: 0, lagerort: "", lieferant: "", artikelnr: "", notiz: "", ek: 0, mwst: 19, sachkonto: "", kostenstelle: "Marketing", shop: { aktiv: false, preis: 0, max: 0 }, aktiv: true, angelegt: jetzt, geaendert: jetzt });
          z.ordner["artikel:" + id] = rel; idZuPfad.set(id, rel); geaendert = true; log(`Ablage: neuer Artikel aus Ordner „${rel}“.`);
          continue;
        }
        const t = leseTxt(text), id = t.id;
        if (!id || !db.artikel[id]) continue;
        if (gefunden.has(id)) continue; // Kopie eines Artikelordners: ignorieren
        gefunden.set(id, rel); idZuPfad.set(id, rel);
        const a = db.artikel[id], altRel = z.ordner["artikel:" + id], d = {};
        if (altRel && altRel !== rel){
          // Ordner verschoben oder umbenannt
          if (KATEGORIEN.includes(kat) && kat !== a.kategorie) d.kategorie = kat;
          if (path.posix.basename(altRel) !== name && sauber(a.name) !== name) d.name = name;
          for (const k of Object.keys(z.txt)) if (k.startsWith(altRel + "/")){ z.txt[rel + k.slice(altRel.length)] = z.txt[k]; delete z.txt[k]; }
          z.ordner["artikel:" + id] = rel;
        }
        if (hash(text) !== z.txt[txtRel]){ Object.assign(d, txtNachArtikel(t, { ...a, ...d })); if (d.name && d.name !== a.name && t.name === a.name) delete d.name; z.txt[txtRel] = hash(text); }
        // Fotos und Dateien
        const dateien = await dateienIn(rel), exp = z.fotos[id] || {}, expNamen = new Set(Object.values(exp));
        const fotoDateien = dateien.filter(f => f.pfad.startsWith(rel + "/Fotos/") && BILD.test(f.name));
        let fotos = (a.fotos || []).filter(f => {
          const u = String(f.url || "");
          if (u.startsWith("ablage/")) return fotoDateien.some(x => "ablage/" + x.pfad === u) || dateien.some(x => "ablage/" + x.pfad === u);
          if (exp[u]) return fotoDateien.some(x => x.name === exp[u]); // in der Ablage gelöscht → auch in der App weg
          return true;
        });
        for (const f of fotoDateien) if (!expNamen.has(f.name) && !fotos.some(x => x.url === "ablage/" + f.pfad)) fotos.push({ id: "", url: "ablage/" + f.pfad, frei: /\.png$|\.svg$/i.test(f.name) });
        if (JSON.stringify(fotos) !== JSON.stringify(a.fotos || [])) d.fotos = fotos;
        const ablage = { pfad: rel, dateien: dateien.filter(f => !(f.pfad.startsWith(rel + "/Fotos/") && BILD.test(f.name))).slice(0, 200) };
        if (JSON.stringify(ablage) !== JSON.stringify(a.ablage || null)) d.ablage = ablage;
        if (Object.keys(d).length){ aendern("artikel", id, { ...a, ...d, ...(d.ablage && Object.keys(d).length === 1 ? {} : { geaendert: new Date().toISOString() }) }); geaendert = true; }
      }
    }
    for (const k of Object.keys(z.gesehen)) if (!existiert(abs(k))) delete z.gesehen[k];
    // 2. Lieferanten, Bestellungen, Eingänge: Dateien zuordnen (Steckbriefe dort schreibt nur die App)
    for (const [art, col] of [["lieferanten", "lieferanten"], ["bestellungen", "bestellungen"], ["eingang", "vorgaenge"]]){
      for (const [key, rel] of Object.entries(z.ordner)){
        if (!key.startsWith(art + ":")) continue;
        const id = key.slice(art.length + 1), d = db[col][id]; if (!d || !existiert(abs(rel))) continue;
        const ablage = { pfad: rel, dateien: (await dateienIn(rel)).slice(0, 200) };
        if (JSON.stringify(ablage) !== JSON.stringify(d.ablage || null)){ aendern(col, id, { ...d, ablage }); geaendert = true; }
      }
    }
    if (await excelLesen()) geaendert = true;
    return geaendert;
  }

  /* ---------- Takt ---------- */
  let laeuft = false, nochmal = false, timer = null;
  async function lauf(){
    if (laeuft){ nochmal = true; return; }
    laeuft = true; status.fehler = "";
    try { await scannen(); await exportieren(); status.zuletzt = new Date().toISOString(); }
    catch (e){ status.fehler = e.message; log("Ablage:", e.message); }
    laeuft = false; if (nochmal){ nochmal = false; setTimeout(lauf, 200); }
  }
  setInterval(lauf, Number(process.env.ABLAGE_TAKT || 4000)).unref();
  setTimeout(lauf, 300);
  return {
    status,
    anstossen(){ clearTimeout(timer); timer = setTimeout(lauf, 800); },
    jetzt: lauf,
    // Dateien aus der Ablage ausliefern (nur lesend, nie System-Ordner)
    pfad(rel){
      const ziel = path.resolve(ORDNER, "." + path.posix.normalize("/" + rel));
      if (!ziel.startsWith(ORDNER + path.sep)) return null;
      const erster = path.relative(ORDNER, ziel).split(path.sep)[0];
      return ["Artikel", "Lieferanten", "Bestellungen", "Eingänge", "Werbemittel.xlsx"].includes(erster) ? ziel : null;
    }
  };
};
