# Fieldwork 2.0B — Intentional Behavior Lab

A phone-first browser prototype built with HTML, CSS, ES modules, and Canvas 2D.

## Current architecture milestone

Build 2.0B keeps the parallel runtime boundary introduced in 2.0A and replaces the old randomized combat sandbox with an intentional Behavior Lab.

The title screen allows either runtime to be selected:

- **Legacy 1.2H** — the existing combat, cover, team-response, and medical AI, now run inside controlled fixtures.
- **AI V2 Foundation** — read-only world snapshots, persistent action lifecycle, action channels, scheduling, decision logging, and invariant monitoring. NPC tactical decisions remain intentionally disabled.

## Behavior Lab fixtures

1. **Open Contact** — recognition, reaction, opportunity fire, and first movement toward safety.
2. **Observation & Concealment** — facing, sight, concealment, personal knowledge, and communication.
3. **Cover & Position** — directional cover, finite positions, reservations, and position persistence.
4. **Casualty Recovery** — casualty recognition, security, dragging, treatment, and withdrawal.

Each fixture uses fixed participants and geometry. There are no random patrol destinations, reinforcement waves, or uncontrolled three-faction churn.

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

The architectural source of truth lives under `docs/architecture/`.

## Next behavior milestone

The next V2 build should use one controlled fixture to implement the smallest explicit behavior chain rather than reactivating general combat. The peaceful damaged-relay slice remains documented in `docs/architecture/05_RELAY_VERTICAL_SLICE.md`.

## Controls

- Touch joystick or WASD: move
- Context button or E: interact/use
- Pack button or B: backpack
- O: operations board
- Escape: close panels
