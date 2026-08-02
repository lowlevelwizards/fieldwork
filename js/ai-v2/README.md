# Fieldwork AI V2

AI V2 is a parallel causal runtime. It does not import the legacy tactical authorities.

## Current milestone: 2.0H

The Observation & Concealment Behavior Lab fixture now runs this explicit chain:

```text
Authored mission
→ tasked observation
→ personal contact memory
→ contact report
→ shared team knowledge
→ mission-relative encounter
→ decision ledger
→ selected response
→ team procedure
→ named phase
→ temporary role
→ actor action proposal
→ scheduler
→ attention execution
```

Northline selects **Heighten Watch**, enters **Security Watch**, and assigns Primary Observer, Alternate Security, and Team Reserve. The Commune selects **Maintain Concealment**, enters **Concealed Observation**, and assigns Concealed Observer, Local Security, and Withdrawal Reserve.

Each operator now interprets their responsibility through the actor action layer:

- Contact observers continue `ObserveSector`.
- Alternate security actors begin `ObserveSector` toward distinct approaches.
- Reserve actors begin `HoldReady` toward the rear option.

All six operators have meaningful persistent actions while remaining at their original coordinates. No cover seeking, targeting, aiming, or firing occurs.

## Current modules

- `runtime/` — update boundary and read-only world snapshots.
- `actions/` — lifecycle, channels, scheduler, ObserveSector, ReportContact, and HoldReady.
- `actors/` — role-action context, local action evaluation, stable reconciliation, provenance adoption, and release.
- `communication/` — local voice timing, recipient validity, and delivery.
- `execution/` — narrow physical attention execution.
- `senses/` — visual evidence from field of view, distance, obstruction, and concealment.
- `knowledge/` — private visual memory and explicitly delivered reported knowledge.
- `missions/` — authored objectives, concern areas, decision context, and persistence policy.
- `encounters/` — mission-relative assessment and persistent uncertain hypotheses.
- `decisions/` — descriptive team decision ledger.
- `responses/` — option evaluation, selection persistence, switching, and invalidation.
- `procedures/` — response mapping, phases, responsibilities, permissions, persistence, and reassignment.
- `diagnostics/` — decision history and ownership invariants.

## Ownership rules

- Fixture data supplies the upstream mission and initial task.
- Team procedures define responsibilities and permissions but never start actions.
- Actor evaluation proposes local actions that can fulfill those responsibilities.
- The role-action runtime reconciles proposals without restarting valid actions.
- The scheduler is the only authority that starts or cancels actor actions.
- Actions own continuity and provenance.
- Executors perform physical attention changes but do not choose sectors or goals.
- Sensors create evidence but do not make decisions.
- Shared knowledge is created only through completed communication actions.
