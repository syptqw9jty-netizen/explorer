# Explorer

Systemübergreifender Datei-Explorer als PWA (iPhone + Windows): Google Drive, iCloud Drive, Apple Notizen und Erinnerungen in einer Oberfläche im Stil der Dateien-App. Dateien liegen nicht in der App – jeder Eintrag verlinkt an den echten Ort.

**App:** https://syptqw9jty-netizen.github.io/explorer/

## Architektur

| Baustein | Wo | Aufgabe |
|---|---|---|
| PWA (dieses Repo) | GitHub Pages | Oberfläche, Offline-Cache, Face ID / Windows Hello |
| `tools/apps-script/Code.gs` | Google Apps Script im eigenen Google-Konto | liest Drive täglich (05:05) ein, führt Änderungsprotokoll, liefert den Index als Web-App, nimmt Apple-Daten per POST entgegen |
| Kurzbefehl „Explorer Sync“ | iPhone | exportiert Notizen, Erinnerungen und iCloud Drive täglich an die Web-App |

Der Index liegt ausschließlich im eigenen Google Drive (Ordner `Explorer-App`). Im öffentlichen Repo stehen nur Code und ein verschlüsselter Demo-Index.

## Einrichtung

### 1. Apps Script (einmalig, ~5 Minuten)
1. https://script.google.com → **Neues Projekt**, Inhalt von `tools/apps-script/Code.gs` einfügen, Projekt „Explorer Sync“ nennen.
2. Links bei **Dienste** auf „+“ → **Drive API** hinzufügen (Kennung `Drive`, Version `v3`).
3. Oben in der Funktionsauswahl **`setup`** wählen → **Ausführen** → Berechtigungen bestätigen. Im Ausführungsprotokoll steht `KEY: …` → kopieren.
4. **Bereitstellen → Neue Bereitstellung** → Typ **Web-App** → Ausführen als **Ich**, Zugriff **Jeder** → Bereitstellen → **Web-App-URL** (endet auf `/exec`) kopieren.
5. In der Explorer-App URL und KEY eintragen (Einrichtungsbildschirm bzw. Zahnrad → Sync).

### 2. Kurzbefehl „Explorer Sync“ (iPhone)
Siehe Abschnitt unten.

### 3. Bereiche anpassen
`RULES` in `Code.gs` (Pfadpräfix → Bereich). Nach einer Änderung einmal `buildIndex` ausführen oder in der App „Index jetzt neu aufbauen“.

## Kurzbefehl „Explorer Sync“ – Schritt für Schritt

Kurzbefehle-App → „+“ → Name **Explorer Sync**. Aktionen in dieser Reihenfolge hinzufügen (Suchfeld unten nutzen):

1. **Notizen suchen** – Filter leer lassen (alle Notizen).
2. **Mit jedem Element wiederholen** (Eingabe: Notizen). Darin:
   - **Wörterbuch** mit den Schlüsseln  
     `source` = `notes` · `name` = *Wiederholungselement › Name* · `folder` = *Wiederholungselement › Ordner* · `created` = *Erstellungsdatum* · `modified` = *Änderungsdatum*  
     (bei den beiden Datumsfeldern auf die Variable tippen → Datumsformat **ISO 8601**, Zeit einschließen).
   - **Zu Variable hinzufügen** → Variablenname `Einträge`.
3. **Erinnerungen suchen** – Filter: *Ist erledigt* ist *falsch* (oder leer für alle).
4. **Mit jedem Element wiederholen** (Eingabe: Erinnerungen). Darin:
   - **Wörterbuch**: `source` = `reminders` · `name` = *Titel* · `list` = *Liste* · `due` = *Fälligkeitsdatum* (ISO 8601) · `done` = *Ist erledigt* · `created` = *Erstellungsdatum* (ISO 8601) · `snippet` = *Notizen*
   - **Zu Variable hinzufügen** → `Einträge`.
5. **Ordnerinhalt abrufen** – Ordner: iCloud Drive auswählen (oberste Ebene), **Rekursiv** einschalten.
6. **Mit jedem Element wiederholen** (Eingabe: Ordnerinhalt). Darin:
   - **Wörterbuch**: `source` = `icloud` · `name` = *Name* · `path` = *Dateipfad* · `size` = *Dateigröße* · `modified` = *Letztes Änderungsdatum* (ISO 8601) · `created` = *Erstellungsdatum* (ISO 8601)
   - **Zu Variable hinzufügen** → `Einträge`.
7. **Inhalt der URL abrufen**  
   URL: `WEB-APP-URL?key=KEY` · *Mehr anzeigen* → Methode **POST** · Anfragetext **JSON** · Feld `items`, Typ **Array**, Wert = Variable `Einträge`.
8. **Mitteilung anzeigen** – Text: `Explorer Sync: ` + *Inhalt der URL*.

Einmal manuell ausführen (▶︎) und Berechtigungen für Notizen, Erinnerungen und Dateien erlauben.

**Automatisch täglich:** Kurzbefehle → **Automation** → „+“ → **Tageszeit** 04:50, täglich → **Sofort ausführen** (nicht „Vor dem Ausführen bestätigen“) → Aktion **Kurzbefehl ausführen** → *Explorer Sync*.

In der App startet der Button „Jetzt aktualisieren“ am iPhone denselben Kurzbefehl; beim Zurückkehren lädt die App den neuen Stand.

## Entwicklung
- `index.html`, `assets/app.js`, `assets/app.css`, `sw.js` – die App, ohne Build-Schritt.
- `tools/sample-index.json` + `tools/encrypt-index.py` – Demo-Index (Passphrase `explorer`).
- `tools/areas.json` / `tools/assign-areas.py` – Bereichsregeln für den Demo-Index (für den Live-Index gelten die `RULES` im Apps Script).
