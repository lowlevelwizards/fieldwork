# Fieldwork AI V2

AI V2 is a parallel causal runtime. It does not import the legacy tactical authorities.

## Current milestone: 2.0I

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
→ position requirement
→ procedure-authorized reposition
→ locomotion execution
→ accepted position
```

Northline selects **Heighten Watch**, enters **Security Watch**, and assigns Primary Observer, Alternate Security, and Team Reserve. The Commune selects **Maintain Concealment**, enters **Concealed Observation**, and assigns Concealed Observer, Local Security, and Withdrawal Reserve.

Each operator now interprets their responsibility through the actor action layer:

- Contact observers continue `ObserveSector`.
- Alternate security actors begin `ObserveSector` toward distinct approaches.
- Reserve actors begin `HoldReady` toward the rear option.

All six operators have meaningful persistent actions. The two security roles relocate once when hard cover prevents their assigned observation; primary observers and reserves remain at their original coordinates. No combat cover seeking, targeting, aiming, or firing occurs.

## Current modules

- `runtime/` — update boundary and read-only world snapshots.
- `actions/` — lifecycle, channels, scheduler, ObserveSector, ReportContact, HoldReady, and RepositionForResponsibility.
- `actors/` — role-action context, local action evaluation, stable reconciliation, role-position requirements, provenance adoption, and release.
- `communication/` — local voice timing, recipient validity, and delivery.
- `execution/` — narrow physical attention and locomotion execution.
- `senses/` — visual evidence from field of view, distance, obstruction, and concealment.
- `knowledge/` — private visual memory and explicitly delivered reported knowledge.
- `missions/` — authored objectives, concern areas, decision context, and persistence policy.
- `encounters/` — mission-relative assessment and persistent uncertain hypotheses.
- `decisions/` — descriptive team decision ledger.
- `responses/` — option evaluation, selection persistence, switching, and invalidation.
- `procedures/` — response mapping, phases, responsibilities, permissions, persistence, and reassignment.
- `position/` — spatial queries and temporary destination claims.
- `diagnostics/` — decision history and ownership invariants.

## Ownership rules

- Fixture data supplies the upstream mission and initial task.
- Team procedures define responsibilities and permissions but never start actions.
- Actor evaluation proposes local actions that can fulfill those responsibilities.
- The role-action runtime reconciles proposals without restarting valid actions.
- The scheduler is the only authority that starts or cancels actor actions.
- Actions own continuity and provenance.
- Executors perform physical attention and locomotion changes but do not choose sectors, destinations, or goals.
- The role-position runtime may propose movement only when procedure permissions and role requirements justify it.
- Only the locomotion executor invokes physical actor movement for AI V2.
- Sensors create evidence but do not make decisions.
- Shared knowledge is created only through completed communication actions.


## 2.0I — Position Requirements

Role-driven actions may now describe spatial requirements. When an authorized security role cannot observe its sector because of hard obstruction, a separate role-position runtime proposes one bounded `RepositionForResponsibility` action. The scheduler owns its lifecycle; a locomotion executor performs movement; temporary destination claims prevent collisions; and the accepted position remains stable.
