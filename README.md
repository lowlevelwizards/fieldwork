# Fieldwork 2.0D — Contact Reporting & Shared Team Knowledge

A phone-first browser prototype built with HTML, CSS, ES modules, and Canvas 2D.

## Current architecture milestone

Build 2.0D keeps the intentional Behavior Lab and extends the first AI V2 cognitive chain inside fixture 02. An authored observer now forms a private contact memory, deliberately reports a credible contact by local voice, and creates second-hand knowledge only for teammates who actually receive the report.

The title screen allows either runtime to be selected:

- **Legacy 1.2H** — the existing combat, cover, team-response, and medical AI, now run inside controlled fixtures.
- **AI V2 — Contact Reporting** — designated observers can observe and report. Recipients retain reported knowledge without personally confirming the contact. Encounter recognition, hostility, cover response, and combat remain intentionally disabled.

## Behavior Lab fixtures

1. **Open Contact** — recognition, reaction, opportunity fire, and first movement toward safety.
2. **Observation & Concealment** — facing, sight, concealment, personal knowledge, communication, and second-hand knowledge.
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
```

The report transfers the observer's belief rather than exact world truth. It retains an approximate position, reduced confidence, source, age, method, and recipient list. Teammates remain physically inert after receiving it.

The next missing capability is encounter recognition: the team knows another group may be present, but has not yet decided whether that presence interferes with its mission.

## Controls

- Touch joystick or WASD: move
- Context button or E: interact/use
- Pack button or B: backpack
- O: operations board
- Escape: close panels
