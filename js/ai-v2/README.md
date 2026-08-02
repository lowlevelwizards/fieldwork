# Fieldwork AI V2

AI V2 is a parallel causal runtime. It does not import the legacy tactical authorities.

## Current milestone: 2.0J

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
→ observed activity track
→ cautious intent hypothesis
→ communicated activity update
→ encounter reassessment
```

Northline selects **Heighten Watch**, enters **Security Watch**, and assigns Primary Observer, Alternate Security, and Team Reserve. The Commune selects **Maintain Concealment**, enters **Concealed Observation**, and assigns Concealed Observer, Local Security, and Withdrawal Reserve.

The two security operators still relocate only when hard obstruction prevents their assigned observation. Opposing observers now see approximate movement, not hidden intent. Meaningful changes can become `ReportContactUpdate` actions, second-hand team evidence, and encounter reassessment. The resulting team responses remain nonviolent and persistent.

No warning, hostility, target selection, aiming, or firing occurs.

## Current modules

- `runtime/` — update boundary and read-only world snapshots.
- `actions/` — lifecycle, channels, scheduler, ObserveSector, ReportContact, ReportContactUpdate, HoldReady, and RepositionForResponsibility.
- `actors/` — role-action context, local action evaluation, stable reconciliation, role-position requirements, provenance adoption, and release.
- `communication/` — local voice timing, recipient validity, initial-contact delivery, and activity-update delivery.
- `execution/` — narrow physical attention and locomotion execution.
- `senses/` — visual evidence plus meaningful observable-activity classification.
- `knowledge/` — private visual memory, approximate contact tracks, cautious intent hypotheses, and explicitly delivered reported knowledge.
- `missions/` — authored objectives, concern areas, decision context, and persistence policy.
- `encounters/` — mission-relative assessment, communicated activity evidence, and persistent uncertain hypotheses.
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
- Contact tracks store approximate observed history, never the target's hidden plan or action reason.
- Activity classification describes visible change; intent hypotheses remain uncertain interpretations.
- Shared knowledge is created only through completed communication actions.
- Encounter reassessment consumes communicated evidence and does not directly create actor actions.

## 2.0J — Activity evidence

A contact can now be remembered across time rather than represented as a single current point. Meaningful movement or visibility changes increment an activity revision. The observer may report a new revision once; stable activity produces no repeated communication. Team knowledge retains the source, age, confidence, approximate positions, observed activity, and explicitly unconfirmed intent hypothesis.
