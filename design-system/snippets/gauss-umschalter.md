# GAUSS Umschalter übernehmen

Ziel: Die vorhandenen Umschalter-Elemente dieser Anwendung auf das GAUSS Design System umstellen.
Funktion, Logik, Texte und Datenfluss bleiben unverändert.

## Schritte
1. Falls noch nicht vorhanden: `gauss-tokens.css` als Datei anlegen und global laden (vor allen anderen Styles).
2. `gauss-umschalter.css` mit dem Inhalt unten anlegen und global laden. Inhalt nicht umformatieren, nichts ergänzen.
3. Bestehende Elemente auf die Klassen umstellen: shadcn `ToggleGroup type="single"` oder `Tabs` als Ansichtswahl → Container `g-umschalter g-ku`, Einträge als `button` mit `aria-pressed`.
4. Eigene Farb-, Radius-, Schatten- und Abstandswerte an diesen Elementen entfernen; nur noch Token-Variablen (`var(--…)`).
5. Doppelte Varianten zusammenlegen, ungenutzte entfernen.

## Regeln
- 2 bis 5 gleichrangige Ansichten oder Zeiträume; mehr → Auswahl.
- Zustand über `aria-pressed`, Gruppe mit `role="group"` und `aria-label`.
- Wechsel wirkt sofort, ohne Bestätigen.

## Nicht
- Keine Komponenten neu schreiben, keine Bibliothek austauschen, keine Logik ändern.
- Keine neuen Farben oder Einzelwerte einführen.

## Prüfen
- Tastatur: Tab erreicht alles, Fokus ist sichtbar.
- Kontrast WCAG 2.2 AA in hell und dunkel (`<html data-theme="dark">`).
- Mobil (390 px): Bedienelemente mindestens 44 px.

## gauss-umschalter.css
```css
/* GAUSS Design System · Umschalter · Stand 29.10.2026
   Gezogen aus dem Design System, nicht von Hand pflegen. Braucht gauss-tokens.css. */
.g-umschalter {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  background: var(--leiste);
  border: 1px solid var(--linie);
  border-radius: var(--radius-aktion);
  padding: 3px;
  gap: 2px;
}
.g-umschalter button {
  border: 0px;
  background: transparent;
  border-radius: var(--radius-aktion);
  min-height: 38px;
  padding: 0px 12px;
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  color: var(--text-sekundaer);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
}
@media (max-width: 767px) {
  .g-umschalter button {
    font-size: 14px;
  }
}
.g-umschalter button:hover {
  background-image: linear-gradient(var(--hover),var(--hover));
}
.g-umschalter button[aria-pressed="true"] {
  background-color: var(--ort-aktiv);
  color: var(--foreground);
  font-weight: 600;
  box-shadow: inset 0 0 0 1.5px var(--neutral-500);
}
.g-umschalter button {
  position: relative;
}
.g-umschalter button::after {
  content: "";
  position: absolute;
  inset: -3px 0px;
}
.g-ku {
  display: inline-grid;
}
.g-umschalter button {
  min-height: 36px;
}
.g-ku button {
  min-width: 64px;
}
```

## Markup-Beispiel
```html
<div class="g-umschalter g-ku" role="group" aria-label="Zeitraum">
  <button type="button" aria-pressed="false">Tag</button>
  <button type="button" aria-pressed="true">Woche</button>
  <button type="button" aria-pressed="false">Monat</button>
</div>
<script>
/* Ein Klick wählt, aria-pressed trägt den Zustand. */
document.querySelectorAll('.g-umschalter').forEach(function (g) {
  g.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    g.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
  });
});
</script>
```
