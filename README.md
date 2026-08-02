# Fieldwork 2.0F — Response Evaluation & Decision Ledger

A phone-first browser prototype built with HTML, CSS, ES modules, and Canvas 2D.

## Current architecture milestone

Build 2.0F keeps the intentional Behavior Lab and extends AI V2 from encounter recognition into explicit team decision-making. Each team compares a mission-relevant contact against a readable ledger of mission value, preservation, information, position, concealment, time, resources, and exit options.

The title screen allows either runtime to be selected:

- **Legacy 1.2H** — the existing combat, cover, team-response, and medical AI, run inside controlled fixtures.
- **AI V2 — Response Evaluation** — designated observers can observe and report; teams can recognize mission interference and select a persistent nonviolent response without issuing actor actions.

## Behavior Lab fixtures

1. **Open Contact** — recognition, reaction, opportunity fire, and first movement toward safety.
2. **Observation & Concealment** — facing, sight, concealment, private knowledge, communication, encounter recognition, and response evaluation.
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
→ ReportContact
→ local voice execution
→ RECEIVED KNOWLEDGE
→ SHARED TEAM REPORT
→ MISSION RELEVANCE
→ ENCOUNTER HYPOTHESIS
→ DECISION LEDGER
→ RESPONSE CANDIDATES
→ SELECTED TEAM RESPONSE
```

Northline selects **Heighten Watch**. The Commune selects **Maintain Concealment**. Both selections remain persistent, cite their tradeoffs, and disappear when their supporting encounter evidence becomes stale.

No procedure is assigned yet. Every actor remains physically still, and no V2 target selection, aiming, or firing occurs.

The next missing capability is procedure formation: a selected response must be translated into phases, temporary responsibilities, and permissions before actors receive new actions.

## Controls

- Touch joystick or WASD: move
- Context button or E: interact/use
- Pack button or B: backpack
- O: operations board
- Escape: close panels
