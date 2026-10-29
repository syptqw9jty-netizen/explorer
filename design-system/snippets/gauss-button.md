# GAUSS Button übernehmen

Ziel: Die vorhandenen Button-Elemente dieser Anwendung auf das GAUSS Design System umstellen.
Funktion, Logik, Texte und Datenfluss bleiben unverändert.

## Schritte
1. Falls noch nicht vorhanden: `gauss-tokens.css` als Datei anlegen und global laden (vor allen anderen Styles).
2. `gauss-button.css` mit dem Inhalt unten anlegen und global laden. Inhalt nicht umformatieren, nichts ergänzen.
3. Bestehende Elemente auf die Klassen umstellen: shadcn `default` → `g-kt g-primaer`, `outline`/`secondary` → `g-kt g-sekundaer`, `ghost`/`link` → `g-kt g-still`, `destructive` → `g-kt g-gefahr`, `size="sm"` → `g-klein`, `size="icon"` → `g-icon g-frei` (bzw. `g-icon g-zeile` in Zeilen).
4. Eigene Farb-, Radius-, Schatten- und Abstandswerte an diesen Elementen entfernen; nur noch Token-Variablen (`var(--…)`).
5. Doppelte Varianten zusammenlegen, ungenutzte entfernen.

## Regeln
- Eine Primär-Aktion je Bereich; Farbe handelt nicht: kein Magenta/Orange als Button-Farbe.
- Höhe 36 px (klein 30 px), mobil immer 44 px; Radius rund (--radius-aktion).
- Zustände nur per Attribut: `disabled`, `aria-pressed="true"`, `aria-busy="true"` – keine eigenen Klassen.
- Nur-Symbol-Buttons brauchen `aria-label`.

## Nicht
- Keine Komponenten neu schreiben, keine Bibliothek austauschen, keine Logik ändern.
- Keine neuen Farben oder Einzelwerte einführen.

## Prüfen
- Tastatur: Tab erreicht alles, Fokus ist sichtbar.
- Kontrast WCAG 2.2 AA in hell und dunkel (`<html data-theme="dark">`).
- Mobil (390 px): Bedienelemente mindestens 44 px.

## gauss-button.css
```css
/* GAUSS Design System · Button · Stand 29.10.2026
   Gezogen aus dem Design System, nicht von Hand pflegen. Braucht gauss-tokens.css. */
.g-kt {
  position: relative;
  vertical-align: middle;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  padding: 0px 14px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-family: var(--font-ui);
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  letter-spacing: -0.006em;
  white-space: nowrap;
  background: transparent;
  color: var(--foreground);
  cursor: pointer;
  transition: background-color 120ms, color 120ms;
}
.g-kt::after {
  content: "";
  position: absolute;
  inset: calc(-4px);
}
.g-kt > svg {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}
.g-kt.g-primaer {
  background-color: var(--primary);
  color: var(--primary-foreground);
}
.g-kt.g-sekundaer {
  background-color: var(--objekt);
  border-color: var(--linie);
  color: var(--foreground);
}
.g-kt.g-still {
  color: var(--text-sekundaer);
}
.g-kt.g-gefahr {
  background-color: var(--status-fehler-text);
  color: var(--primary-foreground);
}
.g-kt.g-icon {
  width: 36px;
  padding: 0px;
}
.g-kt.g-icon.g-zeile {
  width: 30px;
  height: 30px;
  color: var(--text-sekundaer);
}
.g-kt.g-icon.g-frei {
  background-color: var(--objekt);
  border-color: var(--linie);
}
.g-kt.g-klein {
  height: 30px;
  padding: 0px 12px;
  font-size: 12px;
  line-height: 18px;
}
.g-kt.g-klein::after {
  inset: -7px;
}
.g-kt.g-icon.g-zeile::after {
  inset: -7px;
}
.g-kt:hover:not(:disabled) {
  background-image: linear-gradient(var(--hover),var(--hover));
}
.g-kt:active:not(:disabled) {
  background-image: linear-gradient(var(--pressed),var(--pressed));
}
.g-kt.g-still:hover:not(:disabled),.g-kt.g-zeile:hover:not(:disabled) {
  color: var(--foreground);
}
.g-kt:is(.g-primaer, .g-gefahr):hover:not(:disabled) {
  background-image: linear-gradient(color-mix(in oklab,var(--primary-foreground) 14%,transparent),color-mix(in oklab,var(--primary-foreground) 14%,transparent));
}
.g-kt:is(.g-primaer, .g-gefahr):active:not(:disabled) {
  background-image: linear-gradient(color-mix(in oklab,var(--primary-foreground) 22%,transparent),color-mix(in oklab,var(--primary-foreground) 22%,transparent));
}
.g-kt:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}
.g-kt[aria-pressed="true"] {
  background-color: var(--ort-aktiv);
  color: var(--foreground);
  box-shadow: inset 0 0 0 1.5px var(--neutral-500);
  font-weight: 600;
}
.g-kt[aria-busy="true"] {
  cursor: progress;
}
.g-kt[aria-busy="true"] > svg {
  animation: 900ms linear 0s infinite normal none running g-kt-dreh;
}
.g-kt .g-punkt {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--zaehler);
  box-shadow: 0 0 0 2px var(--objekt);
}
@media (max-width: 767px) {
  .g-kt,.g-kt.g-klein {
    height: 44px;
  }
  .g-kt.g-icon,.g-kt.g-icon.g-zeile {
    width: 44px;
    height: 44px;
  }
  .g-kt::after,.g-kt.g-klein::after,.g-kt.g-icon.g-zeile::after {
    inset: 0px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .g-kt[aria-busy="true"] > svg {
    animation: none;
  }
}
.g-kt {
  height: auto;
  min-height: 36px;
}
.g-kt.g-klein {
  min-height: 30px;
}
.g-kt.g-icon {
  height: 36px;
}
@media (max-width: 767px) {
  .g-kt.g-icon {
    height: 44px;
  }
}
@keyframes g-kt-dreh {
  100% {
  transform: rotate(360deg);
  }
}
```

## Markup-Beispiel
```html
<!-- Gewichte: primaer (eine je Bereich), sekundaer, still, gefahr -->
<button type="button" class="g-kt g-primaer">Speichern</button>
<button type="button" class="g-kt g-sekundaer">Abbrechen</button>
<button type="button" class="g-kt g-still">Mehr anzeigen</button>
<button type="button" class="g-kt g-gefahr">Endgültig löschen</button>

<!-- Klein, mit Symbol, nur Symbol (immer mit aria-label) -->
<button type="button" class="g-kt g-sekundaer g-klein">Filter</button>
<button type="button" class="g-kt g-primaer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Neu</button>
<button type="button" class="g-kt g-icon g-frei" aria-label="Weitere Aktionen"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg></button>

<!-- Zustände: gedrückt, lädt, gesperrt -->
<button type="button" class="g-kt g-sekundaer" aria-pressed="true">Nur meine</button>
<button type="button" class="g-kt g-primaer" aria-busy="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9"/></svg>Speichert …</button>
<button type="button" class="g-kt g-primaer" disabled>Senden</button>
```
