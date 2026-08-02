# Fieldwork AI V2

AI V2 is a parallel causal runtime. It does not import the legacy tactical authorities.

## Current milestone: 2.0L

The Observation & Concealment fixture now completes this explicit chain:

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
→ responsibility-driven reposition
→ observable activity
→ cautious intent hypothesis
→ mission boundary activation
→ directed warning
→ heard-warning memory
→ Withdraw Silently response
→ Break Contact Quietly
→ staged route movement
→ observed departure
→ Monitor Departure
→ encounter outcome memory
```

Northline first heightens its watch, then issues one boundary warning. The Commune hears it, judges the concealed watch compromised, and withdraws without replying. The Withdrawal Lead moves first, the Protected Mover follows, and the Rear Watch leaves last. Northline observes the departure, holds position rather than pursuing, and de-escalates. Both teams remember the same event from different evidence positions.

## Current modules

- `runtime/` — update boundary, read-only snapshots, and system composition.
- `actions/` — lifecycle, channels, scheduler, observation, reporting, ready posture, repositioning, warning, and staged withdrawal.
- `actors/` — role context, local action evaluation, stable reconciliation, and role-position requirements.
- `communication/` — local reports and directed raised-voice delivery.
- `execution/` — narrow attention and locomotion execution.
- `senses/` — visual evidence and observable-activity classification.
- `knowledge/` — private memory, contact tracks, team reports, intent hypotheses, and heard-warning memories.
- `missions/` — objectives, concern areas, decision context, boundaries, and authored withdrawal plans.
- `encounters/` — mission-relative assessment, warning evidence, observed departure, and resolved outcome memory.
- `decisions/` — descriptive team decision ledger.
- `responses/` — option evaluation, persistence, switching, de-escalation, and terminal invalidation.
- `procedures/` — response mapping, phases, temporary responsibilities, staged events, and reassignment.
- `position/` — spatial queries and temporary destination claims.
- `diagnostics/` — decision history and ownership invariants.

## Ownership rules reinforced in 2.0L

- Hearing a warning changes evidence; it does not directly move actors.
- The response evaluator may select silent withdrawal but never supplies coordinates.
- The procedure owns withdrawal sequence and temporary responsibilities, not locomotion.
- Each actor proposes `WithdrawToRoute` only during its assigned procedure phase.
- The scheduler owns action lifecycle and channel conflicts.
- The destination-claim service prevents overlapping route destinations.
- The locomotion executor remains the sole writer of actor position and velocity.
- Northline infers departure only from observed activity reports, not hidden Commune state.
- Outcome memory records evidence-grounded consequences and does not create faction reputation or future policy by itself.
