# Spur

Ein Familienbuch, das mitschreibt. Diktat an, Telefon hinlegen, leben – Spur hört zu und erzählt daraus Seiten, die sich lesen wie ein gutes Tagebuch.

## Ablauf
1. **Erzählen** – Modus *Raum* (lange Familiengespräche), *Erzählen* (eine Person) oder *Interview* (Spur fragt).
2. **Hören** – die Aufnahme läuft in Abschnitten (erst 45 s, dann je 2,5 min). Jeder Abschnitt wird verschlüsselt gesichert und sofort verschriftlicht. Text erscheint schon während des Zuhörens; ein Absturz verliert höchstens den laufenden Abschnitt.
3. **Stimmen** – Voxtral trennt Sprecher je Abschnitt; Spur ordnet sie über die mitgeschriebene Tonhöhe abschnittsübergreifend zu (tiefe/hohe Stimme → Erzähler/Kind).
4. **Schreiben** – Claude macht aus dem Transkript eine Seite: Titel, Lead, Absätze, Zwischenüberschriften, Zitate, Höhepunkte. Erzählweise per Regler von *sachlich* bis *erzählerisch*.
5. **Lernen** – jede Seite liefert neues **Wissen** (Menschen, Orte, Kinderwörter, Rituale …) und schreibt die **Erzählstimme** fort. Beides fließt in jede weitere Seite: richtige Schreibweisen, Kontext, Korrekturen von Fehlhörern, ein Ton, in dem man sich wiedererkennt.
6. **Buch** – Kapitel nach Monaten, Suche, Höhepunkte, Beobachtungsprotokoll. *Als Buch drucken* erzeugt ein A5-Buch mit Titelseite (Druck → PDF → Print on Demand).

## Modelle
| Aufgabe | Modell | Warum |
|---|---|---|
| Hören | Mistral **Voxtral Mini Transcribe** | Sprechertrennung, leise Stimmen, Kinder, Deutsch |
| Schreiben, Wissen, Stimme | **Claude Sonnet** (wählbar) | bestes Deutsch, langer Kontext für Stunden an Gespräch |
| Ohne Schlüssel | Live-Diktat / Whisper auf dem Gerät + lokale Ordnung | funktioniert, aber ohne Umformulierung |

## Technik
Statische PWA (GitHub Pages), IndexedDB mit AES-GCM-256 (Schlüssel aus Passcode), Bildschirm-Wachhaltung, Ruhemodus, Service Worker offline. Schlüssel für Mistral und Claude liegen verschlüsselt auf dem Gerät und gehen direkt an den jeweiligen Anbieter.

## Gestaltung
Papier, Sepia-Tinte, warmes Licht. Buchschrift (Iowan Old Style / Palatino), Kapitälchen für Auszeichnungen, Initiale, Zitate mit Ockerlinie. Dieselbe Typografie in App und Druck, damit ein gedrucktes Jahr aussieht wie die App.
