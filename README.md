# Fieldwork 2.0E — Mission Relevance & Encounter Recognition

A phone-first browser prototype built with HTML, CSS, ES modules, and Canvas 2D.

## Current architecture milestone

Build 2.0E keeps the intentional Behavior Lab and extends AI V2 from shared knowledge into team understanding. An authored observer can see and report another armed person; the receiving team now compares that report to its own mission and creates an uncertain encounter hypothesis.

The title screen allows either runtime to be selected:

- **Legacy 1.2H** — the existing combat, cover, team-response, and medical AI, run inside controlled fixtures.
- **AI V2 — Mission Relevance** — designated observers can observe and report. Teams can recognize that a report matters to their mission without identifying hostility or choosing a tactical response.

## Behavior Lab fixtures

1. **Open Contact** — recognition, reaction, opportunity fire, and first movement toward safety.
2. **Observation & Concealment** — facing, sight, concealment, private knowledge, communication, shared reports, and mission-relative encounter recognition.
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
```

The encounter hypothesis cites its supporting report, approximate location, report confidence, mission concern area, relevance level, and authored interference reason. Identity and intent remain unknown. The team selects no response, and every actor remains physically still.

The next missing capability is response evaluation: the team recognizes possible interference but has not compared the available ways to continue, avoid, wait, hide, warn, reroute, or withdraw.

## Controls

- Touch joystick or WASD: move
- Context button or E: interact/use
- Pack button or B: backpack
- O: operations board
- Escape: close panels
