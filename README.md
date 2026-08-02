# Fieldwork 2.0G — Team Procedures, Phases & Temporary Roles

A phone-first browser prototype built with HTML, CSS, ES modules, and Canvas 2D.

## Current architecture milestone

Build 2.0G keeps the intentional Behavior Lab and extends AI V2 from team response selection into explicit coordination structure. Each selected response now creates a persistent procedure, a named phase, temporary responsibilities, permissions, and reassessment triggers without directly controlling actors.

The title screen allows either runtime to be selected:

- **Legacy 1.2H** — the existing combat, cover, team-response, and medical AI, run inside controlled fixtures.
- **AI V2 — Team Procedures** — designated observers can observe and report; teams recognize mission interference, select a response, and organize temporary responsibilities without issuing new actor actions.

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
→ TEAM PROCEDURE
→ PROCEDURE PHASE
→ TEMPORARY ROLES
```

Northline's **Heighten Watch** response creates **Security Watch** with Primary Observer, Alternate Security, and Team Reserve responsibilities. The Commune's **Maintain Concealment** response creates **Concealed Observation** with Concealed Observer, Local Security, and Withdrawal Reserve responsibilities.

Procedures and roles remain persistent, exclusive, and deliberately reassignable if an operator becomes incapable. Every actor remains physically still, and no V2 target selection, aiming, movement, or firing occurs.

The next missing capability is actor interpretation: each operator must propose a local action that fulfills their assigned responsibility without the procedure directly controlling their body.

## Controls

- Touch joystick or WASD: move
- Context button or E: interact/use
- Pack button or B: backpack
- O: operations board
- Escape: close panels
