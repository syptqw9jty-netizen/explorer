# GAUSS Shop

Interner Mitarbeitershop als PWA, im Stil von Werbemittel und Design Bibliothek.

**App:** https://syptqw9jty-netizen.github.io/explorer/shop/

Ohne eingetragene Server-Adresse läuft die App als **Vorschau** mit Demodaten. Bestellungen und Änderungen bleiben dann auf dem jeweiligen Gerät.

## Server einrichten (einmalig, ca. 10 Minuten)

1. Neue Google-Tabelle „GAUSS Shop“ im Firmen-Workspace anlegen (Konto der Shop-Verwaltung).
2. Erweiterungen → Apps Script → Inhalt von `apps-script/Code.gs` einfügen, speichern.
3. Projekteinstellungen → Skripteigenschaften:
   - `DOMAIN` = Firmen-Domain (nur diese Adressen können sich anmelden)
   - `ADMINS` = Mail-Adressen der Verwaltung, mit Komma getrennt (das Skript-Konto ist immer Admin)
4. Funktion `einrichten` einmal ausführen und die Berechtigungen bestätigen.
5. Bereitstellen → Neue Bereitstellung → Web-App, Ausführen als **Ich**, Zugriff **Jeder** → URL kopieren.
6. In `shop/index.html` bei `CONFIG.API_URL` eintragen und committen.

Anmeldung: Mitarbeitende geben ihre Firmen-Adresse ein und bekommen einen sechsstelligen Code per Mail. Die Anmeldung gilt 60 Tage.

## Rechte

| Daten | Mitarbeitende | Verwaltung |
|---|---|---|
| Sortiment, Bestand, Einstellungen | lesen | lesen und ändern |
| Bestellungen | nur eigene | alle |
| Gutscheine, Lieferanten | – | lesen und ändern |

Gutscheincodes werden über einen Hash geprüft, Mitarbeitende sehen die Codes nicht. Mails (Lieferanten, Rechnungen, Monatsbericht) gehen über Gmail des Skript-Kontos, als Entwurf oder direkt.

## Daten aus dem Claude-Artifact übernehmen

Der Shop läuft parallel als Claude-Artifact mit eigenem Speicher. Für den Umzug Produkte als JSON exportieren und in die Tabelle übernehmen (Zeile pro Produkt: `id | json | aktualisiert`). Produktfotos aus dem Artifact müssen neu hochgeladen werden.
