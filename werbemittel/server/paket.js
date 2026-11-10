#!/usr/bin/env node
/* Baut Werbemittel.zip mit genau zwei Einträgen:
     Werbemittel.exe        App-Symbol (Geschenk); startet die App
     Werbemittel-System/    alles andere; beim ersten Start entstehen darin Werbemittel.xlsx, Artikel, Lieferanten, Bestellungen, Eingänge
   Beides zusammen lässt sich beliebig verschieben, auch auf ein Netzlaufwerk; mehrere Rechner können es gleichzeitig nutzen.

   node server/paket.js [ziel.zip]
   NODE_EXE=/pfad/node.exe   Windows-Node, das mitgeliefert wird (sonst ohne; dann muss Node auf den Rechnern installiert sein)
   Werbemittel.exe wird mit Go aus server/start gebaut (GOOS=windows). */
"use strict";
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process"), { zip } = require("./xlsx");
const APP = path.join(__dirname, ".."), ziel = path.resolve(process.argv[2] || path.join(APP, "download", "Werbemittel.zip"));
const exe = path.join(__dirname, "start", "Werbemittel.exe");
execFileSync("go", ["build", "-trimpath", "-ldflags", "-H windowsgui -s -w", "-o", exe, "."], { cwd: path.join(__dirname, "start"), stdio: "inherit",
  env: { ...process.env, GOOS: "windows", GOARCH: "amd64", CGO_ENABLED: "0", GOFLAGS: "-mod=mod", GOPROXY: "off" } });
const dateien = [["Werbemittel.exe", fs.readFileSync(exe)]];
const rein = (quelle, wohin) => dateien.push(["Werbemittel-System/App/" + wohin, fs.readFileSync(path.join(APP, quelle))]);
for (const f of ["index.html", "sw.js", "manifest.webmanifest"]) rein(f, f);
for (const d of ["icons", "demo"]) for (const f of fs.readdirSync(path.join(APP, d))) rein(`${d}/${f}`, `${d}/${f}`);
for (const f of ["server.js", "ablage.js", "xlsx.js"]) rein(`server/${f}`, `server/${f}`);
rein("server/LIESMICH.md", "LIESMICH.md");
if (process.env.NODE_EXE) dateien.push(["Werbemittel-System/App/node/node.exe", fs.readFileSync(process.env.NODE_EXE)]);
else console.warn("Hinweis: ohne NODE_EXE gebaut – Node.js muss dann auf den Rechnern installiert sein.");
fs.mkdirSync(path.dirname(ziel), { recursive: true });
fs.writeFileSync(ziel, zip(dateien));
console.log(`${ziel} (${(fs.statSync(ziel).size / 1048576).toFixed(1)} MB, ${dateien.length} Dateien)`);
