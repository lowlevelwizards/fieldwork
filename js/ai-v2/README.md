# Fieldwork AI V2

AI V2 is a parallel causal runtime. It does not import or advance the legacy tactical decision authorities.

## Current milestone: 2.0O

AI V2 now completes two distinct encounter families and the first adaptive safe-return chain using the same causal foundations.

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

### Casualty Recovery & Adaptive Evacuation

```text
friendly casualty perceived
→ private casualty knowledge
→ report
→ recovery procedure
→ assessment
→ assisted movement
→ stabilization
→ ongoing evacuation obligation
→ evacuation response
→ route affordance evaluation
→ route security
→ casualty transport
→ capability loss
→ role reassignment
→ continued transport
→ transfer
→ safe return
```

The evacuation chain demonstrates the intended sandbox division of responsibility:

```text
TEAM
chooses purpose, priority, response, procedure, and responsibilities

INDIVIDUAL OPERATOR
chooses a locally feasible action that satisfies the current responsibility
```

Procedures define required conditions and role permissions. They do not name actors, prescribe exact elapsed-time choreography, or directly move bodies.

## Module boundaries

- `runtime/` — explicit causal update order and system composition.
- `actions/` — persistent lifecycle, completion/failure, and channel ownership.
- `actors/` — procedure-role context, condition-driven action proposals, and stable reconciliation.
- `communication/` — local reports and directed voice delivery.
- `execution/` — narrow attention, locomotion, and casualty-care mechanics.
- `senses/` — visual contact evidence, activity evidence, and casualty observation.
- `knowledge/` — personal and shared contact/casualty knowledge plus heard communication.
- `missions/` — objectives, obligations, boundaries, withdrawal plans, recovery plans, and evacuation affordances.
- `encounters/` — mission-relative hypotheses and outcome memory.
- `decisions/` — descriptive team decision ledger.
- `responses/` — persistent team response selection.
- `procedures/` — data-defined phases, transitions, permissions, temporary roles, and reassignment.
- `position/` — spatial queries, route-affordance evaluation, and temporary destination claims.
- `diagnostics/` — decision history, invariants, and presentation projections.

## 2.0O sandbox rules

- Route options are world affordances evaluated at runtime; no action assumes one fixed route.
- Carrier selection depends on current transport capability and stamina, not actor name.
- Losing eligibility invalidates the assignment rather than forcing the old carrier to continue.
- The patient, destination, and action channels are released safely before reassignment.
- The procedure retains its unresolved responsibility and resumes after role handoff.
- Route Security and Rear Security remain separate responsibilities during transport.
- The casualty is reassessed between route legs.
- Safe return resolves the local mission but preserves `continued_care_required` and `unavailable_for_field_duty` consequences.
- The same production procedure is tested under different capabilities and route availability.
- No global planner, behavior-tree script, event bus, actor-name branch, or fixture-timed sequence is introduced.

Run all checks with `npm test`.
