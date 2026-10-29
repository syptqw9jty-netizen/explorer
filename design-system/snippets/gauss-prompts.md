# GAUSS Tokens übernehmen

Ziel: Farben, Schrift, Radien und Schatten dieser Anwendung auf die Tokens des GAUSS Design Systems umstellen. Funktion bleibt unverändert.

1. `gauss-tokens.css` mit dem Inhalt unten anlegen und global vor allen anderen Styles laden. Nicht umformatieren.
2. Vorhandene Farbwerte (Hex, rgb, hsl, Tailwind-Farben) auf die passenden Variablen umstellen: Hintergrund `--background`, Text `--foreground`, Text 2 `--text-sekundaer`, Flächen `--objekt`, Linien `--linie`, Primär `--primary`/`--primary-foreground`, Fokus `--fokus`, Status `--status-…-text`/`--status-…-flaeche`.
3. Bei shadcn/ui: die Variablen in `index.css`/`globals.css` (`--background`, `--foreground`, `--primary`, `--border`, `--ring` …) auf die GAUSS-Tokens zeigen lassen, statt Komponenten zu ändern, z. B. `--border: var(--linie)`, `--ring: var(--fokus)`, `--radius: var(--radius-zeile)`.
4. Dunkel: `data-theme="dark"` auf `<html>` statt der Klasse `dark`; ohne Attribut folgt die Anwendung dem System.
5. Marke SoPart: `data-marke="sopart"` auf `<html>`. Ohne Attribut: GAUSS.
6. Doppelte Farbdefinitionen entfernen. Keine neuen Einzelwerte.

## gauss-tokens.css
```css
/* GAUSS Design System · Tokens: Farben, Schrift, Radien, Schatten, Raster, hell/dunkel, Marken · Stand 29.10.2026
   Gezogen aus dem Design System, nicht von Hand pflegen. */
/* Dunkel: folgt dem System, außer <html data-theme="light|dark">. Marke: <html data-marke="sopart"> (Glutorange), ohne Attribut GAUSS (Magenta). */
:root {
  --font-ui: "Funnel Sans",-apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",Roboto,sans-serif;
  --neutral-0: oklch(1 0 0);
  --neutral-50: oklch(0.985 0.004 265);
  --neutral-100: oklch(0.965 0.007 265);
  --neutral-200: oklch(0.92 0.01 265);
  --neutral-300: oklch(0.85 0.014 265);
  --neutral-400: oklch(0.71 0.02 265);
  --neutral-500: oklch(0.58 0.028 265);
  --neutral-600: oklch(0.48 0.038 265);
  --neutral-700: oklch(0.4 0.048 265);
  --neutral-800: oklch(0.34 0.035 265);
  --neutral-900: oklch(0.27 0.04 265);
  --neutral-950: oklch(0.22 0.075 265);
  --neutral-1000: oklch(0.16 0.028 265);
  --marke-hue: 339;
  --marke-050: oklch(0.97 0.016 var(--marke-hue));
  --marke-100: oklch(0.94 0.033 var(--marke-hue));
  --marke-200: oklch(0.89 0.064 var(--marke-hue));
  --marke-300: oklch(0.82 0.11 var(--marke-hue));
  --marke-400: oklch(0.75 0.148 var(--marke-hue));
  --marke-500: oklch(0.68 0.163 var(--marke-hue));
  --marke-600: oklch(0.6 0.153 var(--marke-hue));
  --marke-700: oklch(0.52 0.136 var(--marke-hue));
  --status-fehler-text: oklch(0.5 0.18 18);
  --status-fehler-flaeche: oklch(0.965 0.02 18);
  --status-erfolg-text: oklch(0.47 0.11 150);
  --status-erfolg-flaeche: oklch(0.965 0.03 150);
  --status-info-text: oklch(0.48 0.14 250);
  --status-info-flaeche: oklch(0.965 0.02 250);
  --status-warnung-text: oklch(0.5 0.105 85);
  --status-warnung-flaeche: oklch(0.97 0.055 92);
  --background: var(--neutral-50);
  --leiste: var(--neutral-100);
  --rahmenflaeche: var(--neutral-50);
  --objekt: var(--neutral-0);
  --erhoeht: var(--neutral-200);
  --tastenflaeche: var(--neutral-100);
  --popover: var(--neutral-0);
  --linie: var(--neutral-200);
  --rahmen: var(--neutral-500);
  --tinte-text: oklch(0.31 0.072 262);
  --foreground: var(--tinte-text);
  --text-sekundaer: oklch(0.45 0.062 262);
  --tertiaer: oklch(0.52 0.05 262);
  --deaktiviert: var(--neutral-400);
  --primary: var(--tinte-text);
  --primary-foreground: var(--neutral-0);
  --hover: color-mix(in oklab,var(--neutral-950) 6%,transparent);
  --pressed: color-mix(in oklab,var(--neutral-950) 10%,transparent);
  --ort-aktiv: var(--neutral-200);
  --linie-weich: color-mix(in oklab,var(--linie) 50%,transparent);
  --feld-flaeche: var(--neutral-100);
  --vorgang-kopf: var(--neutral-100);
  --rahmen-leise: var(--neutral-300);
  --gewaehlt: var(--marke-600);
  --gewaehlt-text-flaeche: var(--marke-700);
  --gewaehlt-text-farbe: var(--neutral-0);
  --gewaehlt-text: var(--neutral-0);
  --zaehler: var(--marke-600);
  --fokus: var(--marke-700);
  --fokus-innen: var(--neutral-0);
  --link: var(--marke-700);
  --logo: var(--tinte-text);
  --popup-backdrop: color-mix(in oklab,var(--neutral-950) 20%,transparent);
  --schatten-farbe: var(--neutral-950);
  --schatten-widget: 0 1px 2px color-mix(in oklab,var(--neutral-950) 6%,transparent),0 6px 16px -8px color-mix(in oklab,var(--neutral-950) 18%,transparent);
  --schatten-hoch: 0 20px 48px -16px color-mix(in oklab,var(--schatten-farbe) 16%,transparent),0 4px 14px -8px color-mix(in oklab,var(--schatten-farbe) 8%,transparent);
  --cover-a: var(--neutral-950);
  --cover-a-t: var(--neutral-50);
  --cover-b: var(--neutral-700);
  --cover-b-t: var(--neutral-0);
  --cover-c: var(--neutral-200);
  --cover-c-t: var(--neutral-950);
  --cover-d: var(--neutral-100);
  --cover-d-t: var(--neutral-950);
  --inhalt: 680px;
  --radius-aktion: 999px;
  --radius-zeile: 8px;
  --radius-block: 12px;
  --radius-karte: 16px;
  --radius-flaeche: 20px;
  --hoehe-touchziel: 44px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --dunkel-seite: var(--neutral-1000);
    --dunkel-karte: oklch(0.20 0.03 265);
    --dunkel-erhoeht: oklch(0.245 0.032 265);
    --dunkel-linie: oklch(0.29 0.03 265);
    --status-fehler-text: oklch(0.76 0.14 18);
    --status-fehler-flaeche: oklch(0.29 0.06 22);
    --status-erfolg-text: oklch(0.78 0.12 150);
    --status-erfolg-flaeche: oklch(0.28 0.05 150);
    --status-info-text: oklch(0.78 0.11 250);
    --status-info-flaeche: oklch(0.29 0.06 250);
    --status-warnung-text: oklch(0.85 0.13 88);
    --status-warnung-flaeche: oklch(0.3 0.06 85);
    --background: var(--dunkel-seite);
    --leiste: var(--dunkel-seite);
    --rahmenflaeche: var(--dunkel-seite);
    --objekt: var(--dunkel-karte);
    --erhoeht: var(--dunkel-erhoeht);
    --tastenflaeche: var(--dunkel-erhoeht);
    --popover: var(--dunkel-karte);
    --linie: var(--dunkel-linie);
    --rahmen: var(--neutral-400);
    --foreground: var(--neutral-50);
    --text-sekundaer: var(--neutral-300);
    --tertiaer: var(--neutral-300);
    --deaktiviert: var(--neutral-600);
    --primary: var(--neutral-50);
    --primary-foreground: var(--neutral-950);
    --hover: color-mix(in oklab,white 8%,transparent);
    --pressed: color-mix(in oklab,white 10%,transparent);
    --ort-aktiv: var(--dunkel-erhoeht);
    --feld-flaeche: var(--dunkel-seite);
    --vorgang-kopf: var(--dunkel-karte);
    --rahmen-leise: var(--dunkel-linie);
    --gewaehlt: var(--marke-500);
    --zaehler: var(--marke-500);
    --gewaehlt-text-flaeche: var(--marke-300);
    --gewaehlt-text-farbe: var(--neutral-950);
    --fokus: var(--marke-400);
    --fokus-innen: var(--neutral-950);
    --link: var(--marke-300);
    --logo: var(--neutral-50);
    --popup-backdrop: color-mix(in oklab,var(--neutral-950) 55%,transparent);
    --schatten-farbe: oklch(0.1 0.03 270);
    --schatten-widget: 0 1px 2px color-mix(in oklab,var(--schatten-farbe) 60%,transparent),0 8px 20px -10px color-mix(in oklab,var(--schatten-farbe) 80%,transparent);
    --schatten-hoch: 0 24px 56px -18px color-mix(in oklab,var(--schatten-farbe) 65%,transparent),0 4px 16px -8px color-mix(in oklab,var(--schatten-farbe) 40%,transparent);
    --cover-a: var(--neutral-50);
    --cover-a-t: var(--neutral-950);
    --cover-b: var(--neutral-400);
    --cover-b-t: var(--neutral-950);
    --cover-c: var(--neutral-800);
    --cover-c-t: var(--neutral-50);
    --cover-d: var(--dunkel-erhoeht);
    --cover-d-t: var(--neutral-50);
  }
}
:root[data-theme="dark"] {
  --dunkel-seite: var(--neutral-1000);
  --dunkel-karte: oklch(0.20 0.03 265);
  --dunkel-erhoeht: oklch(0.245 0.032 265);
  --dunkel-linie: oklch(0.29 0.03 265);
  --status-fehler-text: oklch(0.76 0.14 18);
  --status-fehler-flaeche: oklch(0.29 0.06 22);
  --status-erfolg-text: oklch(0.78 0.12 150);
  --status-erfolg-flaeche: oklch(0.28 0.05 150);
  --status-info-text: oklch(0.78 0.11 250);
  --status-info-flaeche: oklch(0.29 0.06 250);
  --status-warnung-text: oklch(0.85 0.13 88);
  --status-warnung-flaeche: oklch(0.3 0.06 85);
  --background: var(--dunkel-seite);
  --leiste: var(--dunkel-seite);
  --rahmenflaeche: var(--dunkel-seite);
  --objekt: var(--dunkel-karte);
  --erhoeht: var(--dunkel-erhoeht);
  --tastenflaeche: var(--dunkel-erhoeht);
  --popover: var(--dunkel-karte);
  --linie: var(--dunkel-linie);
  --rahmen: var(--neutral-400);
  --foreground: var(--neutral-50);
  --text-sekundaer: var(--neutral-300);
  --tertiaer: var(--neutral-300);
  --deaktiviert: var(--neutral-600);
  --primary: var(--neutral-50);
  --primary-foreground: var(--neutral-950);
  --hover: color-mix(in oklab,white 8%,transparent);
  --pressed: color-mix(in oklab,white 10%,transparent);
  --ort-aktiv: var(--dunkel-erhoeht);
  --feld-flaeche: var(--dunkel-seite);
  --vorgang-kopf: var(--dunkel-karte);
  --rahmen-leise: var(--dunkel-linie);
  --gewaehlt: var(--marke-500);
  --zaehler: var(--marke-500);
  --gewaehlt-text-flaeche: var(--marke-300);
  --gewaehlt-text-farbe: var(--neutral-950);
  --fokus: var(--marke-400);
  --fokus-innen: var(--neutral-950);
  --link: var(--marke-300);
  --logo: var(--neutral-50);
  --popup-backdrop: color-mix(in oklab,var(--neutral-950) 55%,transparent);
  --schatten-farbe: oklch(0.1 0.03 270);
  --schatten-widget: 0 1px 2px color-mix(in oklab,var(--schatten-farbe) 60%,transparent),0 8px 20px -10px color-mix(in oklab,var(--schatten-farbe) 80%,transparent);
  --schatten-hoch: 0 24px 56px -18px color-mix(in oklab,var(--schatten-farbe) 65%,transparent),0 4px 16px -8px color-mix(in oklab,var(--schatten-farbe) 40%,transparent);
  --cover-a: var(--neutral-50);
  --cover-a-t: var(--neutral-950);
  --cover-b: var(--neutral-400);
  --cover-b-t: var(--neutral-950);
  --cover-c: var(--neutral-800);
  --cover-c-t: var(--neutral-50);
  --cover-d: var(--dunkel-erhoeht);
  --cover-d-t: var(--neutral-50);
}
:root {
  --marke-800: oklch(0.44 0.113 var(--marke-hue));
  --marke-900: oklch(0.36 0.094 var(--marke-hue));
  --inhalt: 760px;
  --logo-magenta: #9E1981;
  --logo: var(--neutral-950);
  --pb: var(--neutral-950);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --logo: var(--neutral-50);
    --logo-magenta: oklch(0.75 0.185 339);
  }
}
:root[data-theme="dark"] {
  --logo: var(--neutral-50);
  --logo-magenta: oklch(0.75 0.185 339);
}
:root {
  --marke-050: oklch(0.97 0.019 339);
  --marke-100: oklch(0.94 0.039 339);
  --marke-200: oklch(0.89 0.076 339);
  --marke-300: oklch(0.82 0.133 339);
  --marke-400: oklch(0.75 0.185 339);
  --marke-500: oklch(0.68 0.204 339);
  --marke-600: oklch(0.6 0.191 339);
  --marke-700: oklch(0.52 0.17 339);
  --marke-800: oklch(0.44 0.141 339);
  --marke-900: oklch(0.36 0.117 339);
}
html[data-marke="sopart51"] {
  --marke-050: oklch(0.97 0.014 258);
  --marke-100: oklch(0.94 0.029 258);
  --marke-200: oklch(0.89 0.057 258);
  --marke-300: oklch(0.82 0.099 258);
  --marke-400: oklch(0.75 0.147 258);
  --marke-500: oklch(0.68 0.19 258);
  --marke-600: oklch(0.6 0.17 258);
  --marke-700: oklch(0.52 0.15 258);
  --marke-800: oklch(0.44 0.125 258);
  --marke-900: oklch(0.36 0.1 258);
}
html[data-marke="sopart"] {
  --marke-050: oklch(0.97 0.014 36);
  --marke-100: oklch(0.94 0.029 36);
  --marke-200: oklch(0.89 0.057 36);
  --marke-300: oklch(0.82 0.099 36);
  --marke-400: oklch(0.75 0.147 36);
  --marke-500: oklch(0.68 0.203 36);
  --marke-600: oklch(0.6 0.191 36);
  --marke-700: oklch(0.52 0.17 36);
  --marke-800: oklch(0.44 0.141 36);
  --marke-900: oklch(0.36 0.117 36);
}
:root {
  --logo-orange: #FB5C2F;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --logo-orange: oklch(0.75 0.147 36);
  }
}
:root[data-theme="dark"] {
  --logo-orange: oklch(0.75 0.147 36);
}
:root {
  --nav-flaeche: var(--neutral-100);
  --nav-breit: 264px;
  --nav-schmal: 64px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --nav-flaeche: oklch(0.135 0.026 265);
  }
}
:root[data-theme="dark"] {
  --nav-flaeche: oklch(0.135 0.026 265);
}
:root {
  --rand: 40px;
  --spalten: 12;
  --spaltenabstand: 24px;
  --inhalt-max: 880px;
}
@media (min-width: 1280px) {
  :root {
    --rand: 48px;
  }
}
@media (max-width: 1023px) {
  :root {
    --rand: 32px;
    --spalten: 8;
    --spaltenabstand: 20px;
  }
}
@media (max-width: 767px) {
  :root {
    --rand: 16px;
    --spalten: 2;
    --spaltenabstand: 16px;
  }
}
:root {
  --buehne-punkt: color-mix(in oklab,var(--rahmen) 30%,transparent);
}
:root {
  --ps-blau: oklch(0.55 0.15 255);
  --ps-gruen: oklch(0.55 0.12 150);
  --ps-gelb: oklch(0.78 0.14 88);
  --ps-orange: oklch(0.66 0.16 50);
  --ps-rot: oklch(0.57 0.18 25);
  --ps-violett: oklch(0.52 0.15 295);
  --ps-tuerkis: oklch(0.58 0.1 200);
  --ps-grau: oklch(0.58 0.01 265);
}
:root {
  --text-hero: 44px;
  --text-hero-zeile: 48px;
  --text-hero-laufweite: -.028em;
}
@media (max-width: 1023px) {
  :root {
    --text-hero: 40px;
    --text-hero-zeile: 44px;
  }
}
@media (max-width: 767px) {
  :root {
    --text-hero: 34px;
    --text-hero-zeile: 40px;
    --text-hero-laufweite: -.025em;
  }
}
:root {
  --schatten-fenster: 0 0 0 1px color-mix(in oklab,var(--neutral-950,#0b0d12) 10%,transparent),0 2px 4px color-mix(in oklab,var(--neutral-950,#0b0d12) 6%,transparent),0 12px 24px -4px color-mix(in oklab,var(--neutral-950,#0b0d12) 12%,transparent),0 32px 64px -12px color-mix(in oklab,var(--neutral-950,#0b0d12) 24%,transparent);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --schatten-fenster: 0 0 0 1px color-mix(in oklab,#fff 14%,transparent),0 12px 24px -4px rgb(0 0 0/.45),0 32px 64px -12px rgb(0 0 0/.6);
  }
}
:root[data-theme="dark"] {
  --schatten-fenster: 0 0 0 1px color-mix(in oklab,#fff 14%,transparent),0 12px 24px -4px rgb(0 0 0/.45),0 32px 64px -12px rgb(0 0 0/.6);
}
```


---

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


---

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


---

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


---

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


---

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


---

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
