# hero-01 — Split Hero mit Bild

**Kategorie:** hero
**Use-Case:** Landingpages, Startseiten — oberster Abschnitt. Handwerk/Dienstleister, B2B.
**Stil:** Dark, brutalist-clean. Große Headline links, Bild rechts. Gradient-CTA, dezente Trust-Row. Subtiler Glow hinter dem Bild.

## Struktur
- Desktop: 2-Spalten-Grid (`lg:grid-cols-2`). Links: Headline → Subline → CTAs → Trust-Row. Rechts: Bild in `rounded-2xl`-Container mit Border.
- Mobile: Gestapelt. Text oben, Bild unten. Volle Breite.
- Max-Width `max-w-7xl`, Container-Padding `px-4 md:px-6 lg:px-8`.
- Vertikaler Rhythmus: `py-20 md:py-28 lg:py-32`.

## Austauschbare Slots
- `{headline}` — `string` — Hauptüberschrift, `text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight`
- `{subline}` — `string` — Beschreibungstext, `text-lg leading-relaxed text-secondary`
- `{ctaPrimary}` — `{ label: string, href: string }` — Primärer CTA-Button (Gradient), mit ArrowRight-Icon
- `{ctaSecondary}` — `{ label: string, href: string }` (optional) — Sekundärer CTA (Border-Variante), mit ChevronRight-Icon
- `{image}` — `{ src: string, alt: string }` — Hero-Bild, `object-cover` in `rounded-2xl`-Container
- `{trustLogos}` — `Array<{ src: string, alt: string, width?: number }>` (optional) — Trust-Logos, Grayscale mit Hover-Opacity
- Brand-Tokens: `--background` (#0A0A0B), `--surface` (Bild-Border), `--accent-gradient` (CTA), `--text-primary`, `--text-secondary`, `--text-dim`

## Varianten
- A: `imageRight` (default) — Bild rechts, Text links
- B: `imageLeft` — Bild links, Text rechts (via CSS `direction: rtl` Grid-Flip)

## Abhängigkeiten
- `primitives/Button` (Gradient- und Border-Variante)
- `lucide-react` (ArrowRight, ChevronRight)

## Anpass-Hinweise für den Generator
- Trust-Row weglassen wenn keine Logos vorhanden (`trustLogos` prop optional)
- Sekundärer CTA optional — ohne ihn steht der Primary-CTA allein
- Bild-Glow-Farben folgen dem Accent-Gradient — bei Kunden-Tokens anpassen
- Headline-Größe skaliert responsiv, bei längeren Texten ggf. `lg:text-5xl` statt `lg:text-6xl`
