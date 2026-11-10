/*
 * Kleinstes nötiges Excel (xlsx) ohne Pakete: schreiben und lesen.
 * schreibeXlsx([{ name, spalten: [{ titel, breite, bearbeitbar }], zeilen: [[...]] }]) -> Buffer
 * leseXlsx(buffer) -> { Blattname: [[zelle, ...], ...] }   (Zeile 0 = Kopf)
 */
"use strict";
const zlib = require("zlib");

/* ---------- ZIP ---------- */
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf){ let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function zip(dateien){
  const lokal = [], zentral = []; let off = 0;
  const zeit = 0x0000, datum = (2026 - 1980) << 9 | 1 << 5 | 1;
  for (const [name, inhalt] of dateien){
    const n = Buffer.from(name, "utf8"), roh = Buffer.isBuffer(inhalt) ? inhalt : Buffer.from(inhalt, "utf8"), komp = zlib.deflateRawSync(roh), crc = crc32(roh);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8); h.writeUInt16LE(zeit, 10); h.writeUInt16LE(datum, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(komp.length, 18); h.writeUInt32LE(roh.length, 22); h.writeUInt16LE(n.length, 26); h.writeUInt16LE(0, 28);
    lokal.push(h, n, komp);
    const z = Buffer.alloc(46); z.writeUInt32LE(0x02014b50, 0); z.writeUInt16LE(20, 4); z.writeUInt16LE(20, 6); z.writeUInt16LE(0x0800, 8); z.writeUInt16LE(8, 10); z.writeUInt16LE(zeit, 12); z.writeUInt16LE(datum, 14);
    z.writeUInt32LE(crc, 16); z.writeUInt32LE(komp.length, 20); z.writeUInt32LE(roh.length, 24); z.writeUInt16LE(n.length, 28); z.writeUInt32LE(off, 42);
    zentral.push(z, n); off += 30 + n.length + komp.length;
  }
  const zl = zentral.reduce((s, b) => s + b.length, 0), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(dateien.length, 8); e.writeUInt16LE(dateien.length, 10); e.writeUInt32LE(zl, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...lokal, ...zentral, e]);
}
function unzip(buf){
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error("Keine gültige xlsx-Datei.");
  const anzahl = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const aus = {};
  for (let i = 0; i < anzahl; i++){
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const methode = buf.readUInt16LE(p + 10), groesse = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), kl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nl).toString("utf8"), start = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28), daten = buf.slice(start, start + groesse);
    aus[name] = methode === 8 ? zlib.inflateRawSync(daten) : daten; p += 46 + nl + xl + kl;
  }
  return aus;
}

/* ---------- XML ---------- */
const x = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const ent = s => s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, e) => ({ lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" }[e.toLowerCase()] ?? (e[1] === "x" || e[1] === "X" ? String.fromCodePoint(parseInt(e.slice(2), 16)) : String.fromCodePoint(parseInt(e.slice(1), 10)))));
const spalte = i => { let s = ""; i++; while (i > 0){ const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const spalteIndex = ref => { let n = 0; for (const c of ref.replace(/\d+/g, "")) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };

function blattXml(b){
  const kopf = b.spalten.map((s, i) => `<c r="${spalte(i)}1" t="inlineStr" s="${s.bearbeitbar ? 1 : 2}"><is><t>${x(s.titel)}</t></is></c>`).join("");
  const zeilen = b.zeilen.map((z, r) => `<row r="${r + 2}">${z.map((w, i) => {
    if (w === null || w === undefined || w === "") return "";
    const ref = spalte(i) + (r + 2), st = b.spalten[i]?.format === "euro" ? ' s="4"' : b.spalten[i]?.format === "datum" ? ' s="3"' : "";
    return typeof w === "number" && isFinite(w) ? `<c r="${ref}"${st}><v>${w}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${x(w)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const letzte = spalte(Math.max(0, b.spalten.length - 1)) + (b.zeilen.length + 1);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="16"/>
<cols>${b.spalten.map((s, i) => `<col min="${i + 1}" max="${i + 1}" width="${s.breite || 14}" customWidth="1"${s.versteckt ? ' hidden="1"' : ""}/>`).join("")}</cols>
<sheetData><row r="1">${kopf}</row>${zeilen}</sheetData>
${b.spalten.length && b.filter !== false ? `<autoFilter ref="A1:${letzte}"/>` : ""}
</worksheet>`;
}
function schreibeXlsx(blaetter){
  const n = blaetter.length;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;€&quot;"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF6E3F0"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9ECF2"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  return zip([
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${blaetter.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${blaetter.map((b, i) => `<sheet name="${x(b.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${blaetter.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", styles],
    ...blaetter.map((b, i) => [`xl/worksheets/sheet${i + 1}.xml`, blattXml(b)])
  ]);
}

function leseXlsx(buf){
  const d = unzip(buf), txt = n => d[n] ? d[n].toString("utf8") : "";
  const geteilt = [...txt("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => ent([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  const rels = Object.fromEntries([...txt("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map(m => [m[0].match(/Id="([^"]+)"/)?.[1], m[0].match(/Target="([^"]+)"/)?.[1]]));
  const aus = {};
  for (const m of txt("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)){
    const name = ent(m[0].match(/name="([^"]*)"/)?.[1] || ""), rid = m[0].match(/r:id="([^"]+)"/)?.[1];
    let ziel = rels[rid] || ""; ziel = ziel.startsWith("/") ? ziel.slice(1) : "xl/" + ziel.replace(/^\.\//, "");
    const zeilen = [];
    for (const r of txt(ziel).matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)){
      const rn = Number(r[0].match(/\br="(\d+)"/)?.[1]) || zeilen.length + 1, z = [];
      for (const c of (r[1] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
        const attr = c[1], ref = attr.match(/\br="([A-Z]+)\d*"/)?.[1], typ = attr.match(/\bt="([^"]+)"/)?.[1], innen = c[2] || "";
        let w = "";
        if (typ === "s") w = geteilt[Number(innen.match(/<v>([\s\S]*?)<\/v>/)?.[1])] ?? "";
        else if (typ === "inlineStr") w = ent([...innen.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(""));
        else { const v = innen.match(/<v>([\s\S]*?)<\/v>/)?.[1]; w = v === undefined ? "" : typ === "str" || typ === "e" ? ent(v) : typ === "b" ? v === "1" : Number(v); }
        z[ref ? spalteIndex(ref) : z.length] = w;
      }
      zeilen[rn - 1] = Array.from(z, v => v ?? "");
    }
    aus[name] = Array.from(zeilen, v => v || []);
  }
  return aus;
}
module.exports = { schreibeXlsx, leseXlsx, zip, unzip, crc32 };
