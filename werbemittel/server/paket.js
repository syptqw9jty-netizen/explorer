#!/usr/bin/env node
/* Baut Werbemittel.zip: genau ein Ordner „Werbemittel“, darin nur „System“. Beim ersten Start entstehen daneben
   Werbemittel.xlsx und die Ordner Artikel, Lieferanten, Bestellungen, Eingänge; „Einrichten“ legt das App-Symbol an.
   node server/paket.js [ziel.zip] */
"use strict";
const fs = require("fs"), path = require("path"), { zip } = require("./xlsx");
const APP = path.join(__dirname, ".."), ziel = path.resolve(process.argv[2] || path.join(APP, "download", "Werbemittel.zip"));
const dateien = [];
const rein = (quelle, wohin) => dateien.push(["Werbemittel/System/" + wohin, fs.readFileSync(path.join(APP, quelle))]);
for (const f of ["index.html", "sw.js", "manifest.webmanifest"]) rein(f, f);
for (const d of ["icons", "demo"]) for (const f of fs.readdirSync(path.join(APP, d))) rein(`${d}/${f}`, `${d}/${f}`);
for (const f of ["server.js", "ablage.js", "xlsx.js"]) rein(`server/${f}`, `server/${f}`);
rein("server/LIESMICH.md", "LIESMICH.md");
for (const f of ["Werbemittel.vbs", "Einrichten.cmd", "einrichten.ps1"]) rein(`server/windows/${f}`, f);
fs.mkdirSync(path.dirname(ziel), { recursive: true });
fs.writeFileSync(ziel, zip(dateien));
console.log(`${ziel} (${Math.round(fs.statSync(ziel).size / 1024)} KB, ${dateien.length} Dateien)`);
