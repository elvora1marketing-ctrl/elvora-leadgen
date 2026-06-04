# Skill: distill-spec

Design→Spec-Loop. Wird NACH dem Bauen eines Blocks ausgeführt, nicht davor.

## Anweisung

1. Lies den Code in `blocks/<id>/*.tsx` vollständig.
2. Erzeuge `blocks/<id>/spec.md` exakt nach dem Template in `templates/spec.template.md`.
3. Ergänze den passenden Eintrag in `catalog.json` mit dem Datenmodell:

```json
{
  "id": "<id>",
  "category": "<category>",
  "name": "<Name>",
  "description": "<kurze Beschreibung>",
  "tags": ["<tag1>", "<tag2>"],
  "useCase": "<wann/wo einsetzen>",
  "variants": ["<Variante A>", "<Variante B>"],
  "slots": {
    "<slot_name>": { "type": "<type>", "description": "<beschreibung>" }
  },
  "deps": ["<dependency1>", "<dependency2>"],
  "file": "blocks/<id>/<Component>.tsx",
  "spec": "blocks/<id>/spec.md"
}
```

## Regeln

- **Erfinde keine Slots, die der Code nicht hat.** Slots = Props des Exports.
- **Beschreibungen aus dem Code ableiten**, nicht aus Annahmen.
- **Tags sinnvoll wählen:** Kategorie, Layout-Typ, Funktion, Einsatzort.
- **Varianten:** Nur auflisten, was der Code tatsächlich unterstützt (Props/Conditional Rendering).
- **Deps:** Alle externen Imports + `primitives/`-Imports auflisten.
