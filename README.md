# Fieldwork 2.0A — Causal Architecture Foundation

A phone-first browser prototype built with HTML, CSS, ES modules, and Canvas 2D.

## Current architecture milestone

Build 2.0A preserves the working 1.2H combat AI as a legacy research runtime and introduces a parallel AI V2 foundation.

The title screen now allows either runtime to be selected:

- **Legacy 1.2H** — existing combat, cover, team-response, and medical AI.
- **AI V2 Foundation** — read-only world snapshots, persistent action lifecycle, action channels, scheduling, decision logging, and invariant monitoring. NPC tactical decisions are intentionally disabled until the first causal vertical slice is implemented.

The architectural source of truth lives under `docs/architecture/`.

## Causal spine

```text
FACT
→ VALUE
→ NEED
→ GOAL
→ OPERATION
→ MISSION
→ TASK
→ KNOWLEDGE
→ ENCOUNTER
→ RESPONSE
→ PROCEDURE
→ ROLE
→ ACTION
→ EXECUTION
→ CONSEQUENCE
→ MEMORY
→ NEW FACT
```

## Next behavior milestone

The first AI V2 behavior will be the peaceful damaged-relay vertical slice documented in `docs/architecture/05_RELAY_VERTICAL_SLICE.md`.

## Controls

- Touch joystick or WASD: move
- Context button or E: interact/use
- Pack button or B: backpack
- O: operations board
- Escape: close panels
