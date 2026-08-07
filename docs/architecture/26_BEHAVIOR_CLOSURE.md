# 26 — Behavior Closure

## Why 3.1H exists

3.1G keeps important problems owned across atomic action changes. The remaining failure was closure: an actor could preserve a valid hostile-contact, cover, or casualty obligation while repeatedly satisfying it with short movement/hold atoms that did not materially change the world.

3.1H makes the existing architecture close on physical state:

```text
persistent obligation
→ stable local commitment
→ atomic action
→ world-state progress / resolution
→ obligation resolves or is reassessed
```

It does not introduce another brain, team controller, or action gateway.

## Close contact awareness

Normal visual perception still uses facing and field of view. Inside a short close-awareness radius, an opposing operator may also be detected through a 360-degree fallback so two teams cannot walk shoulder-to-shoulder merely because both are looking forward. Hard obstacle occlusion is preserved.

This is local awareness, not omniscience: the fallback is range-bounded, requires line of sight, and feeds the same personal-knowledge system as normal vision.

## Durable cover occupancy

A completed tactical cover move now records a short-lived protected occupancy relationship. The next tactical picture recognizes that relationship instead of forgetting cover the instant movement completes. The relationship expires when the actor leaves the position, the threat direction changes materially, or the occupancy becomes stale.

Tactical commitments are also temporally stable. Reaffirming the same commitment no longer moves its anchor or slides its maximum lifetime forward each frame. Reassessment can therefore happen after one useful local choice instead of chasing a moving goalpost.

## Care closure

Self-aid remains an Immediate Survival obligation, but a wounded operator may no longer defer treatment forever waiting for a perfect treatment-safe frame. After a bounded deferral, self aid may start while exposed unless the actor is currently reacting to incoming fire. It also yields if another caregiver already controls the patient.

A live-sandbox actor staffed as `carrier_or_aid_provider` may directly close the narrow treatment portion of a friendly-casualty obligation:

```text
staffed care obligation
→ approach casualty through spatial intent
→ reach interaction range
→ claim patient
→ finite treatment action
→ consume finite supply
→ wound state changes
```

Legacy casualty procedures remain responsible for multi-step recovery, dragging, evacuation, route security, and transfer.

## Obligation/action identity

An atomic action only counts as serving an obligation when it explicitly carries that stable `obligationId` (with self aid as the one compatibility exception). Sharing a concern ID is no longer sufficient. This prevents unrelated mission travel or `HoldReady` actions from falsely keeping a casualty obligation in the `acting` state.

When a separate governing contact or casualty obligation remains active, ordinary mission-role locomotion is withheld until that higher obligation is resolved or an action explicitly serving it takes over. Immediate incoming-fire survival can still preempt everything.

## Bounded contact resolution

Avoid and contest responses now use acceptable locomotion regions instead of requiring one exact contact-resolution coordinate. Contest positions are held for a bounded interval and then complete into a short reassessment cooldown. Avoidance similarly completes once separation is restored. This prevents the same response from being immediately reissued as an endless kite loop.

## Diagnostics

Behavioral truth now excludes pairs of different teams that share the same known faction from the hostile close-pass metric. This keeps the signal aligned with the actual question: whether opposing factions pass close together without reacting.

## Explicit boundary

3.1H is a closure pass, not an unrestricted combat planner. It does not add authored flank packages, pursuit trees, morale simulation, or a second combat brain. Existing tactical deliberation continues to choose fire, cover, reload, observation, and survival atoms through the unified actor brain and single execution gateway.
