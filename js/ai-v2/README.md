# Fieldwork AI V2

AI V2 is a parallel causal runtime. It does not import or advance the legacy tactical decision authorities.

## Current milestone: 2.0N

Two Behavior Lab fixtures complete distinct causal chains using the same foundations.

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
→ resolved outcome memory
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
→ ongoing evacuation obligation
```

The second chain demonstrates that the same mission, knowledge, response, procedure, role, scheduler, movement, communication, and memory foundations can coordinate care rather than only contact management.

## Module boundaries

- `runtime/` — explicit causal update order and system composition.
- `actions/` — persistent lifecycle and channel ownership.
- `actors/` — procedure-role context, action evaluation, and stable reconciliation.
- `communication/` — local reports and directed voice delivery.
- `execution/` — narrow attention, locomotion, and casualty-care mechanics.
- `senses/` — visual contact evidence, activity evidence, and casualty observation.
- `knowledge/` — personal and shared contact/casualty knowledge plus heard communication.
- `missions/` — objectives, concern areas, boundaries, withdrawal plans, and recovery plans.
- `encounters/` — mission-relative hypotheses and outcome memory.
- `decisions/` — descriptive team decision ledger.
- `responses/` — persistent team response selection.
- `procedures/` — data-defined phases, transitions, permissions, and temporary roles.
- `position/` — spatial queries and temporary destination claims.
- `diagnostics/` — decision history, invariants, and presentation projections.

## 2.0N consolidation rules

- Procedure definitions own event transitions; `TeamProcedureState` applies them generically.
- `AIV2Runtime` remains the visible composition root and does not own UI projection details.
- Fixture content is authored data, separate from the fixture director that instantiates it.
- A completed immediate action is not automatically a completed mission.
- `casualty_stabilized` means immediate bleeding controlled, stable critical, non-ambulatory, and evacuation required.
- Regression tests preserve the completed chains before new behavior is added.
- No event bus, generic planner, dependency-injection framework, or third-party state machine is introduced.

Run all checks with `npm test`.
