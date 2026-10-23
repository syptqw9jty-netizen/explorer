# Spur — MVP

Erzähl einfach. Spur hört zu und macht daraus ein Tagebuch, für dich und die Menschen, die dir wichtig sind.

## Architektur

**Reine Client-App (PWA)**, gehostet als statische Seite auf GitHub Pages. Kein Server, kein Konto.

| Schicht | Umsetzung |
|---|---|
| Schlüssel | Passcode → PBKDF2-SHA-256 (310 000 Runden) → AES-GCM-256, nur im Arbeitsspeicher |
| Speicher | IndexedDB, jeder Datensatz einzeln verschlüsselt (Einträge, Einstellungen, Audio) |
| Aufnahme | MediaRecorder (Audio, verschlüsselt gespeichert, abschaltbar) + Web Audio Analyser für die Klangkugel |
| Transkription | Web Speech API des Geräts (bei Apple teils über Apple-Server); Fallback: Mistral Voxtral (EU), nur auf Wunsch |
| Quelle der Wahrheit | Rohtranskript in Segmenten mit Zeitstempel, unverändert |
| Erzählung | abgeleitet; jeder Absatz verweist auf seine Segmente (antippen zeigt das Gesagte) |
| KI (optional) | Mistral (EU) oder Claude, eigener API-Schlüssel, direkt aus dem Browser. Namen werden vorher durch Platzhalter ersetzt, nur Text wird gesendet |
| Ohne KI | lokale Ordnung in Absätze, Themen, Stichwort-Beobachtungen |
| Beobachtungen | rein beschreibendes Protokoll (Gesundheit, Schlaf, Gefühle, Entwicklung, Konflikt), je nach Einstellung, teilbar fürs Arztgespräch |
| Schutz | Content-Security-Policy erlaubt nur die eigene Seite und die zwei KI-Endpunkte; Auto-Sperre; verschlüsselte Sicherung |

## Modi
- **Erzählen** — frei sprechen
- **Raum** — Telefon hinlegen, Gespräch mitschreiben
- **Interview** — Spur stellt Fragen per Sprachausgabe, nächste Frage nach Stille (mit KI: Nachfragen)

## Grenzen des MVP
- iOS-Spracherkennung im Home-Bildschirm-Modus kann je nach iOS-Version eingeschränkt sein; die Aufnahme läuft dann trotzdem.
- Keine Sprechertrennung, kein Druck, kein Teilen zwischen Geräten (kommt mit der nativen App / Sync-Schicht).
- Passcode vergessen = Daten weg. Das ist Absicht.

## Nächste Schritte
1. Face ID per Passkey (WebAuthn PRF) statt Passcode
2. Geräte-Sync Ende-zu-Ende verschlüsselt
3. Native iOS-App (SwiftUI, On-Device-Transkription mit SpeechAnalyzer)
4. Jahresband als Druck, mit QR-Codes zur echten Stimme
