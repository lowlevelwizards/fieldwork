# 20 — Actor Initiative & Protective Breakaway

## Purpose

2.0P introduces the first bounded combat behavior in AI V2 without reactivating the legacy combat brain.

The proof chain is:

```text
physical hostile event
→ personal threat evidence
→ immediate operator initiative
→ urgent local report
→ shared hostile encounter
→ Break Contact Under Fire
→ Protective Breakaway
→ bounded protective fire and staged movement
→ contact broken
→ persistent outcome memory
```

The goal is not to produce a general firefight. The goal is to prove that an embodied operator can react before team deliberation is complete, then become coordinated by the team's causal decision layers without losing local autonomy.

## Personal initiative before team coordination

A physical near-miss is authored by the Open Contact laboratory fixture. The fixture owns only that world event. It does not prescribe any reaction, report, response, role assignment, movement, or return fire.

`ThreatKnowledgeStore` converts the event into personal evidence for the affected operator:

- event kind;
- approximate source position;
- confidence;
- immediate-threat duration;
- observed hostile activity;
- a hostile intent hypothesis grounded in the physical act.

The operator may then propose two compatible actions:

- `ReactToIncomingFire` on attention and stance channels;
- `ReportContact` on the communication channel.

The reaction therefore does not wait for omniscient team knowledge. The report contains only the approximate source information the operator personally possesses.

## Scheduler preemption

Actions now expose:

- `priority`;
- `interruptible`;
- `preemptionMargin`;
- interruption and cancellation hooks.

A high-priority emergency action may preempt lower-priority interruptible channel owners. It may not preempt an action whose interruption contract forbids it.

The scheduler records the interrupted action, preempting action, both priorities, and the explicit reason. Physical cleanup remains owned by the interrupted action or the narrow runtime that owns its claims.

This is a reusable action-layer capability, not a combat-only exception.

## Team response

Once the urgent report becomes shared knowledge, the existing encounter and decision layers interpret the contact as hostile because the report carries a hostile-action hypothesis.

`Break Contact Under Fire` is eligible only when:

- the encounter is current and mission-relevant;
- hostile physical evidence exists;
- the mission offers a withdrawal route.

The response values team preservation, mobility, immediate time pressure, and available exit options. It does not select a target or directly move or fire an actor.

## Protective Breakaway procedure

The procedure defines three temporary responsibilities:

### Lead Mover

Move first to the authored break-contact route while another operator controls the threat direction.

### Protected Mover

Follow after the lead reaches safety, preserving medically useful or support capacity.

### Covering Operator

Provide one bounded protective burst toward the evidence-grounded threat area, then stop firing and disengage last.

The phases are:

```text
establish_responsibilities
→ lead_movement
→ protected_movement
→ covering_disengagement
→ contact_broken
```

Movement phases advance only when the relevant `WithdrawToRoute` action reaches its destination and reports `withdrawal_stage_completed`.

## Bounded protective fire

`ProtectiveFire` receives a threat point from team knowledge and permission from the active procedure. It does not search the world for enemies.

`FireExecutor` owns only narrow mechanical execution:

- deterministic shot deviation;
- finite magazine consumption;
- friendly-line rejection;
- obstacle impact;
- muzzle, tracer, and impact effects;
- local suppression consequences.

The action is capped at four rounds in the first fixture. After the cap it holds without firing until the procedure authorizes the covering operator to disengage.

The executor does not choose missions, responses, targets, cover, pursuit, or firing duration.

## Outcome

When all three movement responsibilities reach the break-contact route, the outcome memory records:

```text
kind: contact_broken_under_fire
immediateHazardResolved: true
missionResolved: true
followUp: hostile_contact_remembered
violent: roundsFired > 0
```

The result records that violence occurred without treating violence as the team's mission objective.

## Regression proof

The committed checks verify:

- emergency preemption of an interruptible channel owner;
- exactly one physical hostile stimulus;
- personal rather than omniscient threat knowledge;
- one immediate reaction and one urgent report;
- hostile encounter interpretation;
- selection of `break_contact_under_fire`;
- creation of `protective_breakaway`;
- one bounded protective-fire action;
- three ordered staged movements;
- a maximum of four return rounds;
- finite ammunition consumption;
- one `contact_broken_under_fire` outcome;
- released destination claims and clear runtime invariants.

## Explicit exclusions

2.0P does not add:

- generalized cover selection;
- target optimization;
- pursuit;
- assault;
- flanking;
- grenades;
- reload procedures;
- morale or surrender simulation;
- multiple simultaneous threat sources;
- dynamic pathfinding;
- an unrestricted firefight loop;
- any import or update of legacy tactical decision authorities.

The next combat build can activate Cover & Position after this causal spine is stable.
