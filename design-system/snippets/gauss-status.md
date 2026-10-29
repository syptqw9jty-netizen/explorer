# GAUSS Status übernehmen

Ziel: Die vorhandenen Status-Elemente dieser Anwendung auf das GAUSS Design System umstellen.
Funktion, Logik, Texte und Datenfluss bleiben unverändert.

## Schritte
1. Falls noch nicht vorhanden: `gauss-tokens.css` als Datei anlegen und global laden (vor allen anderen Styles).
2. `gauss-status.css` mit dem Inhalt unten anlegen und global laden. Inhalt nicht umformatieren, nichts ergänzen.
3. Bestehende Elemente auf die Klassen umstellen: shadcn `Badge` → `g-kb` plus eine Art: `g-kb-erfolg`, `g-kb-warnung`, `g-kb-fehler`, `g-kb-info`, `g-kb-neutral`.
4. Eigene Farb-, Radius-, Schatten- und Abstandswerte an diesen Elementen entfernen; nur noch Token-Variablen (`var(--…)`).
5. Doppelte Varianten zusammenlegen, ungenutzte entfernen.

## Regeln
- Status ist Text mit Zeichen, nie nur Farbe (kein Ampelsystem).
- Fehler und Warnung tragen immer ein Symbol; Info und Neutral dürfen ohne.
- Zähler brauchen ein `aria-label`, das die Zahl in Worten erklärt.

## Nicht
- Keine Komponenten neu schreiben, keine Bibliothek austauschen, keine Logik ändern.
- Keine neuen Farben oder Einzelwerte einführen.

## Prüfen
- Tastatur: Tab erreicht alles, Fokus ist sichtbar.
- Kontrast WCAG 2.2 AA in hell und dunkel (`<html data-theme="dark">`).
- Mobil (390 px): Bedienelemente mindestens 44 px.

## gauss-status.css
```css
/* GAUSS Design System · Status · Stand 29.10.2026
   Gezogen aus dem Design System, nicht von Hand pflegen. Braucht gauss-tokens.css. */
.g-kb {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 0px 8px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  white-space: nowrap;
  vertical-align: middle;
}
.g-kb > svg {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  margin-left: -2px;
}
.g-kb-erfolg {
  background: var(--status-erfolg-flaeche);
  color: var(--status-erfolg-text);
  box-shadow: inset 0 0 0 1px color-mix(in oklab,var(--status-erfolg-text) 35%,transparent);
}
.g-kb-warnung {
  background: var(--status-warnung-flaeche);
  color: var(--status-warnung-text);
  box-shadow: inset 0 0 0 1px color-mix(in oklab,var(--status-warnung-text) 35%,transparent);
}
.g-kb-fehler {
  background: var(--status-fehler-flaeche);
  color: var(--status-fehler-text);
  box-shadow: inset 0 0 0 1px color-mix(in oklab,var(--status-fehler-text) 35%,transparent);
}
.g-kb-info {
  background: var(--status-info-flaeche);
  color: var(--status-info-text);
  box-shadow: inset 0 0 0 1px color-mix(in oklab,var(--status-info-text) 35%,transparent);
}
.g-kb-neutral {
  background: var(--erhoeht);
  color: var(--foreground);
  box-shadow: inset 0 0 0 1px color-mix(in oklab,var(--foreground) 14%,transparent);
}
.g-kb-zaehler {
  min-height: 20px;
  min-width: 20px;
  padding: 0px 6px;
  justify-content: center;
  font-size: 11px;
  line-height: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  background: var(--gewaehlt-text-flaeche);
  color: var(--gewaehlt-text-farbe);
}
.g-kb-punkt-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
}
.g-kb-punkt {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--zaehler);
}
.g-kb-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
}
```

## Markup-Beispiel
```html
<span class="g-kb g-kb-erfolg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>Erledigt</span>
<span class="g-kb g-kb-warnung"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 4 21 20H3z"/><path d="M12 10v4M12 17h.01"/></svg>Frist bald</span>
<span class="g-kb g-kb-fehler"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/></svg>Überfällig</span>
<span class="g-kb g-kb-info">Neu</span>
<span class="g-kb g-kb-neutral">Entwurf</span>
<span class="g-kb g-kb-neutral g-kb-zaehler" aria-label="3 neue">3</span>
<span class="g-kb-text"><span class="g-kb-punkt" aria-hidden="true"></span>Ungelesen</span>
```
