# Werbemittel

Ein App-Symbol und ein Ordner, sonst nichts:

```
Werbemittel                 ← App (Geschenk-Symbol), Doppelklick startet sie
Werbemittel-System\         ← alles andere, nicht umbenennen
```

Beides zusammen an die richtige Stelle verschieben, z. B. auf das Marketing-Laufwerk. Wer Zugriff auf diesen Ort hat, startet die App mit Doppelklick auf „Werbemittel“. Keine Installation, kein Admin-Recht, kein Server nötig; Node.js ist mitgeliefert.

## Was im Ordner „Werbemittel-System“ entsteht

Beim ersten Start legt die App an:

```
Werbemittel-System\
├─ Werbemittel.xlsx          immer aktuell: Artikel, Größen, Ausgaben, Eingänge, Bestellungen, Lieferanten
├─ Artikel\<Kategorie>\<Name>\
│   ├─ Artikel.txt           Steckbrief, darf bearbeitet werden
│   ├─ Fotos\                Bilder hier erscheinen in der App
│   └─ …                     Druckdaten, Angebote – alles erscheint beim Artikel
├─ Lieferanten\<Name>\       Verträge, Preislisten
├─ Bestellungen\<Jahr>\<Nr Lieferant>\   Angebot, Auftragsbestätigung, Rechnung
├─ Eingänge\<Jahr>\<Datum Lieferant>\    Rechnung, Lieferschein
└─ App\                      Programm, Datenbank (App\Daten), Sicherungen – nicht anfassen
```

| Wo | Was geht | Wann |
|---|---|---|
| App | alles: buchen, zählen, Artikel anlegen und bearbeiten | sofort, alle offenen Fenster aktualisieren sich |
| `Artikel.txt` | Name, Kategorie, Bereich, Lagerort, Meldebestand, Nachbestellregel, Lieferant, Preise, Beschreibung | nach dem Speichern, wenige Sekunden |
| Artikelordner | neuer Ordner unter einer Kategorie = neuer Artikel; umbenennen = neuer Name; verschieben = neue Kategorie | wenige Sekunden |
| Dateien | jede Datei im Artikel-, Bestell- oder Eingangsordner erscheint in der App | wenige Sekunden |
| `Werbemittel.xlsx` | rosa Spalten ändern, neue Zeile ohne ID = neuer Artikel, „Gezählt“ = Inventur | nach dem Speichern |

Bestand entsteht immer aus Buchungen. In Excel deshalb über „Gezählt“ zählen, nicht „Bestand“ überschreiben. Gelöschte Artikel wandern nach `Artikel\_Gelöscht`. Ist die Excel-Datei geöffnet, schreibt die App sie nach dem Schließen neu.

## Mehrere Personen gleichzeitig

Jeder Rechner startet beim Doppelklick seinen eigenen kleinen Server (nur für sich, Adresse `127.0.0.1`), alle lesen und schreiben aber dieselben Daten in `Werbemittel-System`. Schreibvorgänge laufen über eine Sperrdatei, Änderungen der anderen erscheinen nach etwa zwei Sekunden. Ordner und Excel gleicht immer nur ein Rechner ab; geht er aus, übernimmt der nächste. Ohne offenes Fenster beendet sich der Server nach 30 Minuten selbst.

## Erster Start und Verwaltung

- Beim ersten Start gibt es einen Beispielartikel. Entfernen: Einstellungen › Beispieldaten entfernen.
- Verwaltung (Artikel, Preise, Lieferanten, Bestellungen, Eingänge): Passwort `sopart`. Bitte gleich unter Verwaltung › Passwort ändern ersetzen. Gespeichert wird es nur als scrypt-Hash in `App\Daten\geheim.json`.
- Alle anderen dürfen ohne Passwort: Bestand sehen, Ausgaben buchen, zählen, kommentieren und die eigene Buchung 24 Stunden lang stornieren.
- Wer die Ordner direkt bearbeiten darf, steuert die Freigabe des Laufwerks. Wer `Artikel.txt` oder die Excel-Datei ändern kann, kann damit auch Artikel ändern.

## Windows-Hinweis beim ersten Öffnen

`Werbemittel.exe` ist nicht signiert. Wurde die ZIP-Datei aus dem Internet geladen, zeigt Windows evtl. „Der Computer wurde durch Windows geschützt“. Dann: *Weitere Informationen › Trotzdem ausführen*. Einfacher: vor dem Entpacken Rechtsklick auf die ZIP-Datei › Eigenschaften › *Zulassen* anhaken.

## Sichern und Umziehen

Alles steckt in `Werbemittel-System`. Täglich legt die App eine Sicherung in `App\Daten\sicherung\JJJJ-MM-TT` an (30 Tage). Umziehen: App schließen, beides verschieben, fertig.

## Optional: als Dienst auf einem Server

Wer lieber einen festen Server betreibt (z. B. mit `https://` für die Installation als App im Browser):

```
cd Werbemittel-System\App\server
..\node\node.exe server.js
```

| Variable | Standard | Wofür |
|---|---|---|
| `PORT` | 8080 | Port |
| `HOST` | 0.0.0.0 | im ganzen Netz erreichbar; `127.0.0.1` nur für diesen Rechner |
| `ABLAGE_ANZEIGE` | Ordnerpfad | so zeigt die App den Ordner, z. B. `\\server\Werbemittel-System` |
| `VERWALTUNG_PASSWORT` | sopart | Startpasswort beim allerersten Start |
| `DEMO` | ein Beispielartikel | `1` = volle Demo, `0` = ganz leer |
| `ANTHROPIC_API_KEY` | – | optional, für „Mit KI ausfüllen“ |

Als Windows-Dienst z. B. mit [NSSM](https://nssm.cc). Ein Proxy (IIS, nginx, Caddy) muss `/api/events` ohne Pufferung durchreichen.
