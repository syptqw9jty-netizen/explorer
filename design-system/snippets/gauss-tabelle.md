# GAUSS Tabelle (lesen) übernehmen

Ziel: Die vorhandenen Tabelle (lesen)-Elemente dieser Anwendung auf das GAUSS Design System umstellen.
Funktion, Logik, Texte und Datenfluss bleiben unverändert.

## Schritte
1. Falls noch nicht vorhanden: `gauss-tokens.css` als Datei anlegen und global laden (vor allen anderen Styles).
2. `gauss-tabelle.css` mit dem Inhalt unten anlegen und global laden. Inhalt nicht umformatieren, nichts ergänzen.
3. Bestehende Elemente auf die Klassen umstellen: shadcn `Table` → `table.g-tabelle` in `div.g-tab-wrap`; eigene Zeilenhöhen, Farben und Rahmen entfernen.
4. Eigene Farb-, Radius-, Schatten- und Abstandswerte an diesen Elementen entfernen; nur noch Token-Variablen (`var(--…)`).
5. Doppelte Varianten zusammenlegen, ungenutzte entfernen.

## Regeln
- Zum Lesen: Zeile führt zum Objekt; Bearbeiten in Zellen ist das Grid (eigenes Muster, folgt).
- Spaltenköpfe mit `scope="col"`, Beträge rechtsbündig mit Tabellenziffern.
- Breite Tabellen scrollen in `g-tab-wrap` seitlich, die Seite nie.

## Nicht
- Keine Komponenten neu schreiben, keine Bibliothek austauschen, keine Logik ändern.
- Keine neuen Farben oder Einzelwerte einführen.

## Prüfen
- Tastatur: Tab erreicht alles, Fokus ist sichtbar.
- Kontrast WCAG 2.2 AA in hell und dunkel (`<html data-theme="dark">`).
- Mobil (390 px): Bedienelemente mindestens 44 px.

## gauss-tabelle.css
```css
/* GAUSS Design System · Tabelle (lesen) · Stand 29.10.2026
   Gezogen aus dem Design System, nicht von Hand pflegen. Braucht gauss-tokens.css. */
.g-tab-wrap {
  overflow-x: auto;
}
table.g-tabelle {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 20px;
}
.g-tabelle th {
  text-align: left;
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--tertiaer);
  padding: 10px 12px;
  background: var(--rahmenflaeche);
  white-space: nowrap;
}
.g-tabelle td {
  padding: 10px 12px;
  border-top: 1px solid var(--linie);
  vertical-align: top;
}
.g-tabelle td:first-child,.g-tabelle th:first-child {
  padding-left: 16px;
}
.g-tabelle td:last-child,.g-tabelle th:last-child {
  padding-right: 16px;
}
```

## Markup-Beispiel
```html
<div class="g-karte"><div class="g-tab-wrap">
<table class="g-tabelle">
  <caption class="g-sr">Einkommen des Haushalts</caption>
  <thead><tr><th scope="col">Haushaltsmitglied</th><th scope="col">Art</th><th scope="col" style="text-align:right">Betrag</th></tr></thead>
  <tbody>
    <tr><td><b>Derya Sarikaya</b></td><td>Bürgergeld (SGB II)</td><td style="text-align:right;font-variant-numeric:tabular-nums">1.012,00</td></tr>
    <tr><td><b>Elif Sarikaya</b></td><td>Unterhaltsvorschuss</td><td style="text-align:right;font-variant-numeric:tabular-nums">227,00</td></tr>
  </tbody>
</table>
</div></div>
<style>.g-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}</style>
```
