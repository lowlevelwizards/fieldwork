# Fieldwork AI V2

AI V2 is a parallel causal runtime. It does not import the legacy tactical authorities.

## Current milestone: 2.0K

The Observation & Concealment fixture now runs this explicit chain:

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
→ temporary role
→ actor action proposal
→ scheduler
→ position requirement
→ procedure-authorized reposition
→ observable activity
→ cautious intent hypothesis
→ communicated activity update
→ mission boundary activation
→ Issue Warning response
→ Challenge Unknown Contact
→ directed voice execution
→ heard-warning memory
→ Await Response
```

Northline begins with **Heighten Watch**, then selects **Issue Warning** only after a credible activity update activates its mission boundary. The challenge procedure assigns a Challenger while preserving Primary Observer and Alternate Security responsibilities. The Commune hears the warning and keeps **Maintain Concealment**. No reply, hostility, aiming, or firing occurs.

## Current modules

- `runtime/` — update boundary and read-only world snapshots.
- `actions/` — lifecycle, channels, scheduler, observation, reporting, ready posture, repositioning, and directed warning.
- `actors/` — role context, local action evaluation, stable reconciliation, and role-position requirements.
- `communication/` — local team reports plus directed raised-voice delivery.
- `execution/` — narrow physical attention and locomotion execution.
- `senses/` — visual evidence and observable-activity classification.
- `knowledge/` — private visual memory, contact tracks, team reports, intent hypotheses, and heard-warning memories.
- `missions/` — authored objectives, concern areas, decision context, response policy, and mission boundaries.
- `encounters/` — mission-relative assessment plus incoming and outgoing warning evidence.
- `decisions/` — descriptive team decision ledger, including boundary activation.
- `responses/` — option evaluation, selection persistence, switching, and invalidation.
- `procedures/` — response mapping, phases, temporary responsibilities, explicit events, and reassignment.
- `position/` — spatial queries and temporary destination claims.
- `diagnostics/` — decision history and ownership invariants.

## Ownership rules reinforced in 2.0K

- A mission boundary justifies a challenge; presence alone does not.
- The response evaluator selects a warning but never speaks it.
- The challenge procedure assigns a responsibility but never starts an action.
- The actor evaluator proposes `IssueWarning`.
- The scheduler owns start, completion, interruption, and cancellation.
- The communication executor determines actual recipients.
- Heard-warning memory stores recipient belief rather than source truth.
- A delivered-warning event advances the procedure to `Await Response`.
- Encounter assessment may use warning evidence but cannot classify hostility or choose compliance.
