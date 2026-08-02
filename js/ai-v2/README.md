# Fieldwork AI V2

AI V2 is a parallel causal runtime. It does not import the legacy tactical decision authorities.

## Current milestone: 2.0M

Two Behavior Lab fixtures now complete distinct causal chains.

### Observation & Concealment

```text
mission
→ tasked observation
→ private contact knowledge
→ report
→ encounter interpretation
→ response
→ procedure and roles
→ responsibility-driven movement
→ warning
→ silent withdrawal
→ de-escalation
→ outcome memory
```

### Casualty Recovery

```text
friendly casualty perceived
→ private casualty knowledge
→ report
→ Recover Casualty response
→ Casualty Recovery procedure
→ Aid Provider / Security Watch
→ approach
→ assessment
→ assisted movement
→ stabilization
→ outcome memory
```

The second chain is the important architectural test: the same mission, knowledge, response, procedure, role, scheduler, movement, communication, and memory foundations now produce coordinated care rather than another contact-management behavior.

## Current modules

- `runtime/` — update boundary, read-only snapshots, and system composition.
- `actions/` — persistent lifecycle, channels, observation, reporting, movement, warning, withdrawal, and casualty-care actions.
- `actors/` — procedure-role context, local action evaluation, and stable action reconciliation.
- `communication/` — local reports and directed voice delivery.
- `execution/` — narrow attention, locomotion, and casualty-care mechanics.
- `senses/` — visual contact evidence, observable activity, and friendly-casualty observation.
- `knowledge/` — private contact/casualty memory, team reports, intent hypotheses, and heard communications.
- `missions/` — objectives, concern areas, boundaries, withdrawal plans, and recovery plans.
- `encounters/` — mission-relative external-contact and friendly-casualty hypotheses plus outcome memory.
- `decisions/` — descriptive team decision ledger, including urgency and medical capability.
- `responses/` — option evaluation and persistent team response state.
- `procedures/` — response mapping, phases, temporary responsibilities, events, and reassignment.
- `position/` — spatial queries and temporary destination claims.
- `diagnostics/` — decision history, action provenance, position ownership, and exclusive patient-control invariants.

## Ownership rules reinforced in 2.0M

- A casualty becomes a team problem through perception and communication, not global state access.
- Assessment describes condition and treatment need before treatment begins.
- The response evaluator selects recovery but does not move or treat actors.
- The procedure owns phases and responsibilities, not physical execution.
- The actor action runtime proposes the phase-appropriate care action.
- The scheduler owns action lifecycle and channel conflicts.
- The locomotion executor remains the movement writer for the responder.
- The casualty-care executor alone controls dragged-patient position and exclusive patient claims.
- The existing wound system performs treatment mechanics.
- Stabilization stops immediate deterioration without restoring full capability.
