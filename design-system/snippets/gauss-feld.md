# GAUSS Feld übernehmen

Ziel: Die vorhandenen Feld-Elemente dieser Anwendung auf das GAUSS Design System umstellen.
Funktion, Logik, Texte und Datenfluss bleiben unverändert.

## Schritte
1. Falls noch nicht vorhanden: `gauss-tokens.css` als Datei anlegen und global laden (vor allen anderen Styles).
2. `gauss-feld.css` mit dem Inhalt unten anlegen und global laden. Inhalt nicht umformatieren, nichts ergänzen.
3. Bestehende Elemente auf die Klassen umstellen: shadcn `Input`, `Textarea`, `Select`-Trigger → Klasse `g-kf-eingabe`; `Label` + Feld in `g-kf` einwickeln; `FormMessage` → `g-kf-fehler`, `FormDescription` → `g-kf-hilfe`.
4. Eigene Farb-, Radius-, Schatten- und Abstandswerte an diesen Elementen entfernen; nur noch Token-Variablen (`var(--…)`).
5. Doppelte Varianten zusammenlegen, ungenutzte entfernen.

## Regeln
- Beschriftung immer über dem Feld, nie als Platzhalter; optionale Felder tragen „optional“.
- Fehler: `aria-invalid="true"` plus Text mit Zeichen, verbunden über `aria-describedby`. Farbe allein reicht nie.
- Nur lesen: `readonly` (Fläche statt Rahmen); gesperrt: `disabled`.
- Mobil 44 px hoch und 16 px Schrift (kein Zoomen auf dem iPhone).

## Nicht
- Keine Komponenten neu schreiben, keine Bibliothek austauschen, keine Logik ändern.
- Keine neuen Farben oder Einzelwerte einführen.

## Prüfen
- Tastatur: Tab erreicht alles, Fokus ist sichtbar.
- Kontrast WCAG 2.2 AA in hell und dunkel (`<html data-theme="dark">`).
- Mobil (390 px): Bedienelemente mindestens 44 px.

## gauss-feld.css
```css
/* GAUSS Design System · Feld · Stand 29.10.2026
   Gezogen aus dem Design System, nicht von Hand pflegen. Braucht gauss-tokens.css. */
.g-kf {
  display: grid;
  align-content: start;
  gap: 4px;
  min-width: 0px;
}
.g-kf label {
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  color: var(--foreground);
}
.g-kf-opt {
  font-weight: 400;
  color: var(--text-sekundaer);
}
.g-kf-hilfe {
  margin: 0px;
  font-size: 12px;
  line-height: 18px;
  color: var(--text-sekundaer);
}
.g-kf-fehler {
  margin: 0px;
  display: flex;
  gap: 6px;
  align-items: flex-start;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  color: var(--status-fehler-text);
}
.g-kf-fehler svg {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  margin-top: 1px;
}
.g-kf-eingabe {
  width: 100%;
  min-height: 36px;
  padding: 7px 12px;
  border-radius: var(--radius-zeile);
  border: 1px solid var(--rahmen);
  background: var(--feld-flaeche);
  color: var(--foreground);
  font-style: inherit;
  font-variant: inherit;
  font-weight: inherit;
  font-stretch: inherit;
  font-family: inherit;
  font-optical-sizing: inherit;
  font-size-adjust: inherit;
  font-kerning: inherit;
  font-feature-settings: inherit;
  font-variation-settings: inherit;
  font-language-override: inherit;
  font-size: 13px;
  line-height: 20px;
  transition: border-color 120ms;
}
.g-kf-eingabe::placeholder {
  color: var(--tertiaer);
}
.g-kf-eingabe:hover:not(:disabled):not([readonly]),.g-kf-eingabe[data-v="hover"] {
  border-color: var(--foreground);
}
.g-kf-eingabe:focus-visible,.g-kf-eingabe[data-v="fokus"] {
  border-color: var(--foreground);
  outline: 2px solid var(--fokus);
  outline-offset: 2px;
  box-shadow: 0 0 0 2px var(--fokus-innen);
}
.g-kf-eingabe[aria-invalid="true"] {
  border: 2px solid var(--status-fehler-text);
  padding: 6px 11px;
}
.g-kf-eingabe:disabled {
  background: var(--erhoeht);
  border-color: var(--linie);
  color: var(--deaktiviert);
  cursor: not-allowed;
}
.g-kf-eingabe[readonly] {
  border-color: transparent;
  background: var(--feld-flaeche);
}
.g-kf-mehr {
  min-height: 80px;
  resize: vertical;
}
.g-kf-auswahl,.g-kf-einheit {
  position: relative;
  display: block;
}
.g-kf-auswahl select {
  appearance: none;
  padding-right: 36px;
}
.g-kf-auswahl svg {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  pointer-events: none;
  color: var(--text-sekundaer);
}
.g-kf-einheit input {
  padding-right: 40px;
  text-align: right;
}
.g-kf-datum input {
  text-align: left;
}
.g-kf-einheit > span {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 13px;
  color: var(--text-sekundaer);
  pointer-events: none;
  display: flex;
}
.g-kf-einheit > span svg {
  width: 16px;
  height: 16px;
}
.g-kf-raster {
  display: grid;
  grid-template-columns: repeat(2, minmax(0px, 1fr));
  gap: 20px 16px;
  width: 100%;
}
.g-kf-zusammen {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: var(--radius-block);
  background: var(--status-fehler-flaeche);
  box-shadow: inset 0 0 0 2px var(--status-fehler-text);
}
.g-kf-zusammen b {
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--status-fehler-text);
  font-size: 13px;
  line-height: 20px;
}
.g-kf-zusammen b svg {
  width: 16px;
  height: 16px;
}
.g-kf-zusammen a {
  font-size: 13px;
  line-height: 20px;
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  justify-self: start;
}
@media (max-width: 767px) {
  .g-kf-raster {
    grid-template-columns: minmax(0px, 1fr);
  }
  .g-kf-eingabe {
    min-height: 44px;
    font-size: 16px;
    line-height: 22px;
    padding: 10px 12px;
  }
  .g-kf-eingabe[aria-invalid="true"] {
    padding: 9px 11px;
  }
}
textarea.g-kf-eingabe {
  min-height: 96px;
  resize: vertical;
}
select.g-kf-eingabe {
  appearance: none;
  padding-right: 36px;
  background-image: linear-gradient(45deg,transparent 50%,var(--text-sekundaer) 50%),linear-gradient(135deg,var(--text-sekundaer) 50%,transparent 50%);
  background-position: calc(100% - 18px) 50%, calc(100% - 13px) 50%;
  background-size: 5px 5px;
  background-repeat: no-repeat;
}
.g-kf-check input[type="radio"] {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  margin: 0px;
  accent-color: var(--gewaehlt);
}
```

## Markup-Beispiel
```html
<div class="g-kf-raster">
  <div class="g-kf">
    <label for="f-name">Name des Kindes</label>
    <input class="g-kf-eingabe" id="f-name" value="Mia Berger" autocomplete="off">
  </div>
  <div class="g-kf">
    <label for="f-betrag">Monatlicher Betrag</label>
    <p class="g-kf-hilfe" id="f-betrag-h">Netto, ohne Kindergeld</p>
    <span class="g-kf-einheit"><input class="g-kf-eingabe" id="f-betrag" inputmode="decimal" value="420,00" aria-describedby="f-betrag-h"><span aria-hidden="true">€</span></span>
  </div>
  <div class="g-kf">
    <label for="f-amt">Zuständiges Amt</label>
    <select class="g-kf-eingabe" id="f-amt"><option>Jugendamt</option><option>Sozialamt</option></select>
  </div>
  <div class="g-kf">
    <label for="f-az">Aktenzeichen</label>
    <input class="g-kf-eingabe" id="f-az" value="JA-2026-0" aria-invalid="true" aria-describedby="f-az-f">
    <p class="g-kf-fehler" id="f-az-f"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/></svg>Das Aktenzeichen hat 11 Zeichen. Es fehlen 2.</p>
  </div>
  <div class="g-kf">
    <label for="f-partner">Bei Partner</label>
    <input class="g-kf-eingabe" id="f-partner" value="Nunegi, Sen" readonly>
  </div>
  <div class="g-kf">
    <label for="f-bem">Bemerkung <span class="g-kf-opt">optional</span></label>
    <textarea class="g-kf-eingabe g-kf-mehr" id="f-bem"></textarea>
  </div>
</div>
```
