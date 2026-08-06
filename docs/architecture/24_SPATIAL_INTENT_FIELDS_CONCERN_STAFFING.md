# 24 — Spatial Intent Fields and Concurrent Concern Staffing

## 3.1E: actor-sized spatial intent

Ordinary locomotion no longer needs one controller to prescribe one exact destination. A behavior proposal may instead describe an acceptable field:

```text
center + shape + inner/outer bounds + preferred radius
+ separation + cohesion + threat pressure
```

`SpatialIntentFieldService` derives stable circle or annulus fields from a staffed team concern. `TacticalSteeringService` continuously chooses a short-lived steering target inside that field while preserving teammate spacing, local obstacle projection, cohesion, and threat repulsion. `MoveWithinIntentFieldAction` owns locomotion through the unified actor brain and completes when the actor satisfies the region, not when it touches one magic coordinate.

Exact points remain valid only where the world exposes a hard affordance:

- a finite directional-cover slot;
- treatment or casualty-custody range;
- a physical supply/objective interaction point;
- a route waypoint whose completion changes campaign state.

Legacy responsibility and objective approach movement now use small acceptable regions even while their procedures remain compatibility adapters.

## 3.1F: stable concurrent concern staffing

`TeamConcernStaffingService` converts each active concern's minimum and preferred responsibilities into stable actor assignments. Selection considers:

- capability fit;
- current procedural role fit;
- distance to the concern;
- concern importance and urgency;
- current assignment load;
- injury/capability state;
- continuity and reassignment hysteresis.

An actor can support more than one independent concern, but cannot fill two slots on the same concern. Required slots are staffed before preferred slots. Assignments remain stable until a materially better actor is available or the incumbent becomes incapable.

Staffing is written back to `TeamConcernBoard`, exposed on each actor, and attached to legacy procedure proposals as `concernId` and `desiredEffect`. This lets the unified brain explain which concurrent obligation an otherwise legacy action is serving.

## Transitional execution boundary

3.1E–F deliberately does not delete every procedure. Multi-step physical interactions still need a narrow atomic executor. During this stage:

- mission progress and safe return remain compatibility-bound to procedures and operation-route actions;
- actors currently owned by a procedure keep that atomic executor;
- unowned live-sandbox actors may directly fulfill secondary contact or casualty-security assignments through intent fields;
- Behavior Lab fixtures retain deterministic authored choreography;
- exact cover-slot claims are reconciled immediately after actor-brain resolution if their movement proposal was rejected.

The next removal pass can expand direct fulfillment one concern family at a time without reopening the single-authority problem solved in 3.1C–D.
