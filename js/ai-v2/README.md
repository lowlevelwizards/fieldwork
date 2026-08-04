# Fieldwork AI V2

## 2.7 continuous tactical deliberation

Procedures define responsibilities and constraints; the new tactical-picture and deliberation services continuously let actors propose locally sensible ways to fulfill them. Personal perception, threat memory, suppression, wounds, cover, spacing, and responsibility are consolidated before atomic actions compete through the authority arbiter.


AI V2 is a parallel causal runtime. It does not import or advance the legacy tactical decision authorities.

## Current milestone: 2.0P

AI V2 now completes observation and de-escalation, casualty recovery and adaptive safe return, and the first bounded hostile-contact response using the same causal foundations.

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

### Actor Initiative & Protective Breakaway

```text
physical hostile event
→ private threat knowledge
→ immediate actor initiative
→ urgent local report
→ shared hostile encounter
→ break-contact response
→ temporary responsibilities
→ bounded protective fire
→ staged movement
→ contact broken
```

The hostile-contact chain demonstrates the intended relationship between individual and team authority:

```text
INDIVIDUAL OPERATOR
may respond immediately to personally perceived danger
and communicate only what they actually know

TEAM
interprets the shared evidence, selects the response,
defines the procedure, and assigns temporary responsibilities

INDIVIDUAL OPERATOR
executes a locally feasible action within those permissions
```

Procedures define required conditions and role permissions. They do not name actors, prescribe exact elapsed-time choreography, select targets, or directly move bodies or fire weapons.

## Module boundaries

- `runtime/` — explicit causal update order and system composition.
- `actions/` — persistent lifecycle, channel ownership, priority, interruption, completion, and failure.
- `actors/` — emergency initiative, procedure-role context, condition-driven action proposals, and stable reconciliation.
- `communication/` — local reports and directed voice delivery.
- `execution/` — narrow attention, locomotion, casualty-care, and bounded fire mechanics.
- `senses/` — visual contact evidence, activity evidence, and casualty observation.
- `knowledge/` — personal and shared contact/casualty knowledge, personal threat evidence, and heard communication.
- `missions/` — objectives, obligations, boundaries, withdrawal plans, recovery plans, and evacuation affordances.
- `encounters/` — mission-relative hypotheses and outcome memory.
- `decisions/` — descriptive team decision ledger.
- `responses/` — persistent team response selection and extension registration.
- `procedures/` — data-defined phases, transitions, permissions, temporary roles, reassignment, and extension registration.
- `position/` — spatial queries, route-affordance evaluation, and temporary destination claims.
- `diagnostics/` — decision history, invariants, and presentation projections.

## 2.0P sandbox rules

- The Open Contact fixture authors exactly one physical near-miss; it does not author the reaction or response.
- Threat knowledge belongs first to the affected operator and contains an approximate source position.
- Emergency actions can preempt lower-priority interruptible channel owners through the scheduler contract.
- Urgent reporting reuses the communication layer and does not reveal an exact shooter identity.
- Hostile evidence permits **Break Contact Under Fire** only when a viable withdrawal route exists.
- Protective Breakaway separates Lead Mover, Protected Mover, and Covering Operator responsibilities.
- Protective fire receives a known threat area; it does not search for targets.
- The first protective burst is finite, deterministic, ammunition-limited, and rejected when a friendly occupies the firing line.
- Existing destination claims and staged withdrawal movement remain the single locomotion authority.
- `contact_broken_under_fire` records that violence occurred without treating violence as the mission objective.
- Cover selection, pursuit, assault, flanking, morale, and unrestricted firefights remain excluded.

Run all checks with `npm test`.
