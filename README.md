# Fieldwork 2.0H — Procedure-Driven Actor Actions

A phone-first browser prototype built with HTML, CSS, ES modules, and Canvas 2D.

## Current architecture milestone

Build 2.0H keeps the intentional Behavior Lab and connects temporary procedural responsibilities to persistent individual actions without allowing procedures to control actors directly.

The title screen allows either runtime to be selected:

- **Legacy 1.2H** — the existing combat, cover, team-response, and medical AI, run inside controlled fixtures.
- **AI V2 — Actor Actions** — teams observe, report, recognize mission interference, select a response, organize responsibilities, and let each operator propose an action that fulfills their role.

## Behavior Lab fixtures

1. **Open Contact** — recognition, reaction, opportunity fire, and first movement toward safety.
2. **Observation & Concealment** — facing, sight, concealment, private knowledge, communication, encounter recognition, response evaluation, procedure roles, and actor fulfillment.
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
→ OBSERVATION
→ PERSONAL KNOWLEDGE
→ REPORT
→ SHARED KNOWLEDGE
→ ENCOUNTER
→ RESPONSE
→ PROCEDURE
→ PHASE
→ ROLE
→ ACTION PROPOSAL
→ SCHEDULER
→ ATTENTION EXECUTION
```

Northline's roles produce:

- Primary Observer → `ObserveSector`
- Alternate Security → `ObserveSector` on another approach
- Team Reserve → `HoldReady`

The Commune's roles produce:

- Concealed Observer → `ObserveSector`
- Local Security → `ObserveSector` on the flank
- Withdrawal Reserve → `HoldReady`

The original two observation actions are adopted in place by their procedural roles rather than restarted. All six operators now have meaningful actions, but nobody changes position, seeks cover, selects a target, aims, or fires.

The next missing capability is position adequacy: an action must be able to recognize that the current location cannot fulfill its responsibility before requesting procedure-authorized movement.

## Controls

- Touch joystick or WASD: move
- Context button or E: interact/use
- Pack button or B: backpack
- O: operations board
- Escape: close panels
