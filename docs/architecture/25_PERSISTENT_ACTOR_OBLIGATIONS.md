# 25 — Persistent Actor Obligations

## Why 3.1G exists

3.1E–F can discover concurrent concerns, staff them, and produce spatial intent. The remaining control gap is temporal: an atomic action can complete, fail, or lose arbitration even though the world problem that justified it still exists.

3.1G adds a durable actor-owned obligation between staffing/personal survival evidence and atomic execution:

```text
world problem
→ staffed or personal obligation
→ accepted by one actor
→ one or more atomic actions
→ interruption / reassessment / another atomic action
→ source physically resolves
→ obligation resolves
```

An action ending no longer means the actor has forgotten why it was acting.

## Stable obligation sources

`ActorObligationStore` projects two deliberately narrow source families in 3.1G:

- staffed team concerns from `TeamConcernStaffingService`;
- personal self-aid needs when a conscious actor has a treatable wound and the required finite supply.

A staffed obligation keeps the same stable ID as long as the staffing slot remains assigned to the actor. Repeated action changes do not recreate it. It records acceptance time, latest confirmation, current action IDs, interruptions, desired effect, responsibility, priority, urgency, and authority tier.

## Authority

Obligations do not create a second action arbiter. They decorate proposals that still pass through:

```text
ActorObligationStore
→ behavior producer
→ UnifiedActorBrain
→ ActorActionArbiter
→ ActionScheduler
```

Required hostile-contact obligations receive governing-response authority. Casualty aid/provider obligations receive governing-response authority. Mission and safe-return obligations remain mission-responsibility authority. Personal self-aid is immediate-survival authority.

This is intentionally enough for a material hostile obligation to displace unchanged route travel without granting every secondary concern emergency authority.

## Procedure coexistence

A procedure only suppresses direct concern fulfillment when it is actually operating on the same physical subject. Holding an unrelated mission role no longer prevents an actor from fulfilling a separately staffed hostile-contact or casualty-security obligation.

Legacy procedures remain the atomic executor for multi-step care, evacuation, warning, objective work, and other authored interactions in 3.1G. Their actions are bound to the corresponding obligation when staffing supplies one.

## Persistence semantics

An obligation can be:

- `accepted` — source remains active, actor currently has no bound atomic action;
- `acting` — one or more active scheduler actions are serving it;
- `blocked` — a proposal was rejected, but the source remains unresolved;
- `resolved` — the concern/treatment source ended or the staffing assignment moved elsewhere;
- `abandoned` — the actor became unavailable.

If a bound action ends while the source remains active, the obligation returns to `accepted` rather than disappearing. The next decision frame can select another physical method.

## Not in 3.1G

3.1G does not yet add unrestricted firefight planning, direct buddy-treatment execution outside the existing casualty procedure, pursuit, flank plans, morale, or the anti-loop closure rules planned for 3.1H. Its job is narrower: make important problems stay owned long enough for those later tactical behaviors to have continuity.
