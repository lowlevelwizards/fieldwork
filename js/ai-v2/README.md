# Fieldwork AI V2

AI V2 is a parallel causal runtime. It does not import the legacy tactical authorities.

## Current milestone: 2.0D

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
```

One observer on each team turns toward an authored sector and may form private contact records. Once a visible contact reaches the authored credibility threshold, the observer starts a timed local-voice report. Only nearby, conscious teammates receive it.

A report does not transmit world truth. It carries the observer's approximate position, classification, confidence, observation age, source identity, method, and recipient list. Recipients do not count the report as personal visual confirmation.

There is intentionally no encounter recognition or tactical response yet. Receiving a report does not cause movement, target selection, cover seeking, or weapon use.

## Current modules

- `runtime/` — update boundary and read-only world snapshots.
- `actions/` — persistent action lifecycle, channels, scheduler, ObserveSector, and ReportContact.
- `communication/` — local voice range, timing, recipient validity, and delivery execution.
- `execution/` — narrow physical attention execution.
- `senses/` — visual evidence from field of view, distance, obstruction, and concealment.
- `knowledge/` — private visual memory plus explicitly delivered reported knowledge.
- `diagnostics/` — decision history and invariant monitoring.

## Ownership rules

- Fixture data supplies the upstream reason and reporting policy.
- Actions own behavioral continuity.
- Executors perform physical or communicative delivery but do not choose goals.
- Sensors produce evidence but do not make decisions.
- Personal knowledge stores direct beliefs but does not share them automatically.
- Team knowledge accepts only reports that a communication action actually delivered.
- The scheduler is the only authority that starts or ends actions.
- Local voice may coexist with observation because it occupies the communication channel rather than replacing the observer's attention action.
