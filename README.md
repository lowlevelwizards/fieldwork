# Fieldwork 2.0C — Tasked Observation & Personal Knowledge

A phone-first browser prototype built with HTML, CSS, ES modules, and Canvas 2D.

## Current architecture milestone

Build 2.0C keeps the intentional Behavior Lab and introduces the first narrow AI V2 cognitive chain inside fixture 02: an authored observation responsibility produces a persistent action and private contact memory.

The title screen allows either runtime to be selected:

- **Legacy 1.2H** — the existing combat, cover, team-response, and medical AI, now run inside controlled fixtures.
- **AI V2 — Tasked Observation** — one designated observer per team can turn toward an authored sector, gather visual evidence, and retain personal-only contact memory. Communication, team knowledge, encounters, and combat responses remain intentionally disabled.

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

## Current V2 behavior

Fixture 02 now proves:

```text
MISSION
→ TASK
→ PROCEDURE
→ ROLE
→ ObserveSector
→ visual evidence
→ PERSONAL KNOWLEDGE
```

The contact remains private to the observer. The next missing capability is an explicit `ReportContact` action that can transfer selected knowledge to a teammate; it should not be added until 2.0C is visually verified.

## Controls

- Touch joystick or WASD: move
- Context button or E: interact/use
- Pack button or B: backpack
- O: operations board
- Escape: close panels
