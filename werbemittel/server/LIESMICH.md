# Werbemittel auf dem Firmenserver

Die App läuft im Firmennetz. Mitarbeitende öffnen sie im Browser, ohne etwas zu installieren. Alle Daten bleiben auf dem Server, und ein normaler Ordner mit Excel-Datei bleibt laufend synchron zur App.

## Ein Ordner, ein App-Symbol

`Werbemittel.zip` enthält genau einen Ordner. Nach dem ersten Start sieht er so aus:

```
Werbemittel                 ← App-Symbol (Geschenk), legt „System\Einrichten“ an
Werbemittel\
├─ Werbemittel.xlsx          immer aktuell: Artikel, Größen, Ausgaben, Eingänge, Bestellungen, Lieferanten
├─ Artikel\
│   └─ Textilien\
│       └─ Hoodie, Grau meliert\
│           ├─ Artikel.txt   Steckbrief, darf bearbeitet werden
│           ├─ Fotos\        Bilder hier erscheinen in der App
│           └─ …             Druckdaten, Angebote, alles andere erscheint beim Artikel
├─ Lieferanten\<Name>\       Verträge, Preislisten
├─ Bestellungen\<Jahr>\<Nr Lieferant>\   Angebot, Auftragsbestätigung, Rechnung
├─ Eingänge\<Jahr>\<Datum Lieferant>\    Rechnung, Lieferschein
└─ System\                   App, Server, Datenbank, Sicherungen – nicht anfassen
```

### Was synchron bleibt

| Wo | Was geht | Wann |
|---|---|---|
| App | alles wie bisher | sofort, alle Fenster aktualisieren sich |
| `Artikel.txt` | Name, Kategorie, Bereich, Lagerort, Meldebestand, Nachbestellregel, Lieferant, Preise, Beschreibung | nach dem Speichern, wenige Sekunden |
| Artikelordner | neuen Ordner unter einer Kategorie anlegen = neuer Artikel; umbenennen = neuer Name; in andere Kategorie verschieben = neue Kategorie | wenige Sekunden |
| Dateien | jede Datei im Artikel-, Bestell- oder Eingangsordner erscheint in der App und lässt sich dort öffnen | wenige Sekunden |
| `Werbemittel.xlsx` | rosa Spalten ändern, neue Zeile ohne ID = neuer Artikel, Spalte „Gezählt“ = Inventur | nach dem Speichern |

Bestand entsteht immer aus Buchungen (Ausgabe, Eingang, Inventur). Deshalb ändert man ihn in Excel über „Gezählt“, nicht über „Bestand“. Gelöschte Artikel verschwinden nicht, ihr Ordner wandert nach `Artikel\_Gelöscht`. Ist die Excel-Datei gerade geöffnet, schreibt die App sie nach dem Schließen neu.

## Einrichten in drei Schritten

1. **Node.js 18 oder neuer** auf dem Server installieren (https://nodejs.org, LTS). Sonst nichts: keine Datenbank, keine Pakete.
2. `Werbemittel.zip` auf ein Laufwerk des Servers entpacken, z. B. `D:\Freigaben\Werbemittel`. Den Ordner für die Marketing-Kolleg:innen freigeben.
3. `System\Einrichten.cmd` doppelklicken. Es legt das App-Symbol „Werbemittel“ neben dem Ordner und auf dem Desktop an und startet die App.

Für alle anderen: im Browser `http://<servername>:8080` öffnen und über das Browsermenü „App installieren“ wählen. Dann liegt das Geschenk-Symbol in Taskleiste oder Startmenü (dafür braucht es `https://`, siehe unten; ohne läuft alles im Browser-Tab).

Damit „Pfad kopieren“ in der App den Netzwerkpfad zeigt, beim Start `ABLAGE_ANZEIGE=\\server\Werbemittel` setzen.

## Was die IT braucht

- Einen Windows- oder Linux-Server im Firmennetz mit **Node.js 18 oder neuer**. Sonst nichts: keine Datenbank, keine npm-Pakete.
- `Werbemittel.zip` (oder den Ordner `werbemittel/` aus dem Repository; dann ist die Ablage aus, solange `ABLAGE` nicht gesetzt ist).
- Einen freien Port, z. B. 8080, und einen DNS-Namen wie `werbemittel.gauss.local`.

## Starten

```
cd Werbemittel\System\server
node server.js
```

Die Ausgabe zeigt die Adresse im Firmennetz. Beim allerersten Start legt die App einen Beispielartikel an; Kategorien und Bereiche sind immer vorhanden.

Einstellungen über Umgebungsvariablen:

| Variable | Standard | Wofür |
|---|---|---|
| `PORT` | 8080 | Port |
| `DATEN` | `server/daten` | Datenordner, am besten auf einem gesicherten Laufwerk |
| `SICHERUNG_TAGE` | 30 | Anzahl Tagessicherungen |
| `ABLAGE` | im Paket der Ordner über `System` | synchroner Ordner; `0` schaltet ihn ab |
| `ABLAGE_ANZEIGE` | Serverpfad | so zeigt die App den Ordner, z. B. `\\server\Werbemittel` |
| `DEMO` | ein Beispielartikel | `1` = volle Demo, `0` = ganz leer (nur beim allerersten Start) |
| `ANTHROPIC_API_KEY` | – | optional, für „Mit KI ausfüllen“ |

## Dauerhaft betreiben

**Windows Server:** mit [NSSM](https://nssm.cc) als Dienst einrichten: `nssm install Werbemittel "C:\Program Files\nodejs\node.exe" "D:\apps\werbemittel\server\server.js"`, Umgebungsvariablen im Reiter *Environment*.

**Linux:** systemd-Dienst:

```
[Unit]
Description=GAUSS Werbemittel
After=network.target
[Service]
WorkingDirectory=/srv/werbemittel/server
ExecStart=/usr/bin/node server.js
Environment=PORT=8080 DATEN=/srv/werbemittel-daten
Restart=always
User=werbemittel
[Install]
WantedBy=multi-user.target
```

**Docker:** `docker run -d -p 8080:8080 -v /srv/werbemittel-daten:/daten -e DATEN=/daten -v $PWD/werbemittel:/app -w /app/server node:22-alpine node server.js`

## Rechte

| Wer | Darf |
|---|---|
| Alle im Firmennetz | Bestand und Ausgaben sehen, Ausgaben buchen, zählen oder schätzen, kommentieren, eigene Buchung innerhalb von 24 Stunden stornieren |
| Verwaltung (PIN) | zusätzlich Artikel, Preise, Fotos, Lieferanten, Bestellungen, Eingänge, Exporte |

Die PIN legt die erste Person fest, die in der App „Anmelden“ wählt. Sie wird auf dem Server nur als scrypt-Hash gespeichert (`daten/geheim.json`); nach fünf Fehlversuchen ist die Anmeldung fünf Minuten gesperrt. Die Prüfung passiert auf dem Server, nicht im Browser.

Der Server ist für das interne Netz gedacht und hat keine Benutzerkonten. Soll er von außen erreichbar sein, gehört er hinter VPN oder einen Reverse Proxy mit Firmen-Anmeldung.

## HTTPS und App-Symbol

Im Browser läuft alles auch über `http://`. Wer die App auf dem Startbildschirm oder als Desktop-App installieren will, braucht `https://` (Vorgabe der Browser). Dafür den Server hinter IIS, nginx oder Caddy mit Firmenzertifikat stellen; der Proxy muss `/api/events` ohne Pufferung durchreichen (Live-Aktualisierung).

## Sichern und Umziehen

Alles Nötige liegt im Datenordner. Zum Umziehen: Dienst stoppen, Ordner kopieren, auf dem neuen Server starten. Zum Zurückspielen einer Sicherung: Dienst stoppen, die JSON-Dateien aus `sicherung/JJJJ-MM-TT/` in den Datenordner kopieren, Dienst starten.
