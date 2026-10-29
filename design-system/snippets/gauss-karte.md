# GAUSS Karte und Kachel übernehmen

Ziel: Die vorhandenen Karte und Kachel-Elemente dieser Anwendung auf das GAUSS Design System umstellen.
Funktion, Logik, Texte und Datenfluss bleiben unverändert.

## Schritte
1. Falls noch nicht vorhanden: `gauss-tokens.css` als Datei anlegen und global laden (vor allen anderen Styles).
2. `gauss-karte.css` mit dem Inhalt unten anlegen und global laden. Inhalt nicht umformatieren, nichts ergänzen.
3. Bestehende Elemente auf die Klassen umstellen: shadcn `Card` → `g-karte` (Innenabstand 16 px über eigenen Inhalt); Link-Kachel → `a.g-kachel`.
4. Eigene Farb-, Radius-, Schatten- und Abstandswerte an diesen Elementen entfernen; nur noch Token-Variablen (`var(--…)`).
5. Doppelte Varianten zusammenlegen, ungenutzte entfernen.

## Regeln
- Karten gruppieren, sie handeln nicht: ganze Kachel klickbar nur als `a` mit sprechendem Text.
- Gleiche Höhe je Reihe; Titel oben bündig, Zusatz unten.
- „folgt“-Kacheln gestrichelt, ohne Schatten.

## Nicht
- Keine Komponenten neu schreiben, keine Bibliothek austauschen, keine Logik ändern.
- Keine neuen Farben oder Einzelwerte einführen.

## Prüfen
- Tastatur: Tab erreicht alles, Fokus ist sichtbar.
- Kontrast WCAG 2.2 AA in hell und dunkel (`<html data-theme="dark">`).
- Mobil (390 px): Bedienelemente mindestens 44 px.

## gauss-karte.css
```css
/* GAUSS Design System · Karte und Kachel · Stand 29.10.2026
   Gezogen aus dem Design System, nicht von Hand pflegen. Braucht gauss-tokens.css. */
.g-karte {
  background: var(--objekt);
  border: 1px solid var(--linie);
  border-radius: var(--radius-karte);
  box-shadow: var(--schatten-widget);
  overflow: hidden;
}
.g-kacheln {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 10px;
}
.g-kachel {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border-radius: var(--radius-karte);
  border: 1px solid var(--linie);
  background: var(--objekt);
  color: inherit;
  text-decoration: none;
  box-shadow: var(--schatten-widget);
}
a.g-kachel:hover {
  background-image: linear-gradient(var(--hover),var(--hover));
}
.g-kachel b {
  font-weight: 600;
}
.g-kachel span {
  font-size: 13px;
  line-height: 20px;
  color: var(--text-sekundaer);
}
.g-kachel.g-folgt {
  box-shadow: none;
  background: transparent;
  border-style: dashed;
}
.g-kachel.g-folgt b {
  color: var(--text-sekundaer);
}
.g-kachel {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}
.g-kachel > b {
  display: block;
  line-height: 22px;
}
.g-kachel > .g-meta + .g-meta {
  margin-top: auto;
  padding-top: 8px;
}
.g-kachel span {
  text-wrap: pretty;
}
.g-kachel span {
  hyphens: manual;
  overflow-wrap: break-word;
}
@media (max-width: 600px) {
  .g-kachel {
    display: grid;
    grid-template-columns: 88px minmax(0px, 1fr);
    gap: 2px 12px;
    align-content: start;
    padding: 12px;
  }
  .g-kachel > .g-vorschau {
    grid-area: 1 / 1 / span 4;
    width: 88px;
    margin: 0px;
    align-self: start;
  }
  .g-kachel > :not(.g-vorschau) {
    grid-column: 2;
  }
  .g-kachel > .g-meta + .g-meta {
    margin-top: 0px;
    padding-top: 4px;
  }
}
.g-kachel .g-vorschau {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 200 / 96;
  margin: 0px 0px 8px;
  border-radius: 10px;
  background: var(--rahmenflaeche,var(--background));
  box-shadow: inset 0 0 0 1px var(--linie);
}
```

## Markup-Beispiel
```html
<!-- Karte: Fläche mit Rahmen und leisem Schatten, Inhalt mit eigenem Innenabstand -->
<section class="g-karte" aria-labelledby="k1-t" style="padding:16px">
  <h3 id="k1-t" style="margin:0 0 4px;font-size:15px;line-height:22px">Auf einen Blick</h3>
  <p style="margin:0;color:var(--text-sekundaer)">Örtliche Zuständigkeit: gegeben</p>
</section>

<!-- Kacheln: Raster, Titel oben, „Für:“ unten auf einer Linie -->
<div class="g-kacheln">
  <a class="g-kachel" href="#"><b>Einführung</b><span class="g-meta">Definition, Anwendung, Organisation</span><span class="g-meta">Für: alle</span></a>
  <a class="g-kachel" href="#"><b>Grundlagen</b><span class="g-meta">Marke, Farbe, Typografie</span><span class="g-meta">Für: alle</span></a>
  <div class="g-kachel g-folgt"><b>Vorlagen</b><span class="g-meta">folgt</span></div>
</div>
```
