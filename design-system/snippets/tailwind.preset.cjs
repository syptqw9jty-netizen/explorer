// GAUSS Design System · Tailwind-Preset
// Bindet die CSS-Variablen aus theme.css an Tailwind-Namen. Tailwind 4: @config "../tokens/tailwind.preset.cjs" in src/styles.css; Tailwind 3: presets: [require("./tokens/tailwind.preset.cjs")]
// Voraussetzung: theme.css ist global geladen (z. B. @import "../tokens/theme.css" in src/index.css).
module.exports = {
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-ui)"] },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)", hover: "var(--hover)", pressed: "var(--pressed)" },
        leiste: "var(--leiste)",
        rahmenflaeche: "var(--rahmenflaeche)",
        objekt: "var(--objekt)",
        erhoeht: "var(--erhoeht)",
        tastenflaeche: "var(--tastenflaeche)",
        popover: "var(--popover)",
        linie: { DEFAULT: "var(--linie)", weich: "var(--linie-weich)" },
        rahmen: { DEFAULT: "var(--rahmen)", leise: "var(--rahmen-leise)" },
        tinte: "var(--tinte-text)",
        sekundaer: "var(--text-sekundaer)",
        tertiaer: "var(--tertiaer)",
        deaktiviert: "var(--deaktiviert)",
        feld: "var(--feld-flaeche)",
        gewaehlt: { DEFAULT: "var(--gewaehlt)", text: "var(--gewaehlt-text)" },
        fokus: { DEFAULT: "var(--fokus)", innen: "var(--fokus-innen)" },
        link: "var(--link)",
        status: {
          "fehler-text": "var(--status-fehler-text)", "fehler-flaeche": "var(--status-fehler-flaeche)",
          "erfolg-text": "var(--status-erfolg-text)", "erfolg-flaeche": "var(--status-erfolg-flaeche)",
          "info-text": "var(--status-info-text)", "info-flaeche": "var(--status-info-flaeche)",
          "warnung-text": "var(--status-warnung-text)", "warnung-flaeche": "var(--status-warnung-flaeche)"
        },
        neutral: Object.fromEntries([0,50,100,200,300,400,500,600,700,800,900,950,1000].map(n => [n, `var(--neutral-${n})`])),
        marke: Object.fromEntries(["050",100,200,300,400,500,600,700,800,900].map(n => [n, `var(--marke-${n})`]))
      },
      borderRadius: {
        aktion: "var(--radius-aktion)", zeile: "var(--radius-zeile)", block: "var(--radius-block)",
        karte: "var(--radius-karte)", flaeche: "var(--radius-flaeche)"
      },
      boxShadow: { widget: "var(--schatten-widget)", hoch: "var(--schatten-hoch)" },
      minHeight: { touch: "var(--hoehe-touchziel)" },
      maxWidth: { inhalt: "var(--inhalt)" }
    }
  }
};
