# Skill: generate-page

Wenn der User eine Seite/Section will, arbeite in dieser Reihenfolge:

## 1. RETRIEVE
- Lies `catalog.json`.
- Wähl die passenden Blocks anhand von `category`/`tags`/`useCase`.
- Liste deine Auswahl + gewählte Variante kurz auf. Warte NICHT auf Bestätigung bei klarem Auftrag.

## 2. ASSEMBLE
- Lade den echten Code der gewählten Blocks aus `blocks/<id>/`.
- Lade die Brand-Tokens aus `presets/<kunde>.tokens.json`.
- Lade die Design-Regeln (System-Prompt-Sektion in `CLAUDE.md`).

## 3. ADAPT (nicht neu erfinden)
- Setz die Blocks in der vom User gewünschten Reihenfolge zusammen.
- Tausch NUR: Brand-Tokens, Texte (Slots), Bilder, Variante.
- Struktur/Layout des Blocks bleibt — er ist bereits kuratiert.

## 4. SELBSTKRITIK (Pflicht)
- Nenn 3 konkrete Schwächen des Ergebnisses (Spacing? Hierarchie? fehlender State? wirkt generisch?) und behebe sie sofort.

## 5. OUTPUT
- Schreib in die Projektstruktur. Saubere, typisierte Komponenten.
- Kurze Begründung der Block-Auswahl (1–2 Sätze), keine Code-Wand.

## 6. REFINE
- Auf Feedback: kleine, gezielte Änderungen. Nicht alles neu generieren.

---

**REGEL:** Gibt es keinen passenden Block im Katalog, sag das offen und schlag vor, einen neuen Block zu bauen (→ dann `distill-spec` danach). Erfinde keinen "Wegwerf-Block" still.
