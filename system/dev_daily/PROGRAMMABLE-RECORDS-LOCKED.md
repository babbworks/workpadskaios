# Programmable records — locked (v0.4 wire)
_2026-05-24. Near-term slice on G6 / rule block. Evaluator: `js/lib/programmable-rules.js`._

---

## Six primitives

| ID | Opcode | Args | Plain language |
|----|--------|------|----------------|
| PR-1 | `when_confirmed` | `u16` action mask LE | Obligation advances when these actions are confirmed |
| PR-2 | `when_declined` | `u16` action mask LE | Rule fires when any listed action is declined |
| PR-3 | `when_paid` | — | Obligation closes when a payment child exists on chain |
| PR-4 | `when_date_before` | `u16` days since 2000-01-01 | Valid only before this date |
| PR-5 | `when_date_reached` | `u16` days since 2000-01-01 | Triggers on or after this date |
| PR-6 | `when_ack_received` | `u8` party slot (0 = any) | Triggers when ack record received from slot |

Record field: `programmable_rules: [{ op, mask?, date?, partySlot? }]`

---

## Wire (G6 tail, after TRIG / display_schema)

```
[0x50]              ; block tag PROGRAM_RULES_V1
[0x01]              ; grammar version
[u8 count]          ; max 8 rules per record
per rule:
  [u8 opcode 0–5]
  [u8 arg_len]
  [arg_len bytes]
```

Bounded: max **8** rules, max **4** args bytes each, no loops. Unknown opcode → skip rule on decode; evaluator treats as `unknown`.

---

## App

- Encode: `RecordService.encodeUrl` passes `programmable_rules` from record
- Decode: `record.programmable_rules` + `record._programmablePlain` hints
- UI: plain-language strings from `WPProgrammableRules.describeRule()`
- Compose: `WPProgrammableCompose` on wizard **Story** tab + share **Obligations** section; view **Edit obligations** → wizard story

---

_End._
