# Fieldwork AI V2

AI V2 is a parallel causal runtime. It does not import the legacy tactical authorities.

## Current milestone: 2.0E

The Observation & Concealment Behavior Lab fixture now runs this explicit cognitive chain:

```text
Authored mission
→ tasked observation
→ temporary observer role
→ persistent ObserveSector action
→ attention execution
→ visual evidence
→ personal contact memory
→ persistent ReportContact action
→ local voice execution
→ received second-hand knowledge
→ shared team report
→ mission relevance assessment
→ uncertain team encounter hypothesis
```

Each team has its own authored mission concern area and interprets only the reports that were actually delivered to it. Another armed group's presence can become mission relevant or potentially incompatible without becoming a known enemy.

There is intentionally no response selection yet. Encounter recognition does not cause movement, cover seeking, target selection, aiming, or firing.

## Current modules

- `runtime/` — update boundary and read-only world snapshots.
- `actions/` — persistent action lifecycle, channels, scheduler, ObserveSector, and ReportContact.
- `communication/` — local voice range, timing, recipient validity, and delivery execution.
- `execution/` — narrow physical attention execution.
- `senses/` — visual evidence from field of view, distance, obstruction, and concealment.
- `knowledge/` — private visual memory plus explicitly delivered reported knowledge.
- `missions/` — authored team objectives, conditions, concern areas, and mission sensitivity.
- `encounters/` — mission-relative assessment and persistent uncertain encounter hypotheses.
- `diagnostics/` — decision history and invariant monitoring.

## Ownership rules

- Fixture data supplies the upstream mission, task, reporting policy, and concern area.
- Actions own behavioral continuity.
- Executors perform physical or communicative delivery but do not choose goals.
- Sensors produce evidence but do not make decisions.
- Personal knowledge stores direct beliefs but does not share them automatically.
- Team knowledge accepts only reports that a communication action actually delivered.
- Mission assessment describes why a report matters but does not command a response.
- Team encounter memory retains the hypothesis and its evidence without declaring hostility.
- The scheduler is the only authority that starts or ends actions.
