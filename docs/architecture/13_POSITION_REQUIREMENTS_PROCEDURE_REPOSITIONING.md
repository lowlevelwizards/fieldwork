# Position Requirements & Procedure-Authorized Repositioning

Build 2.0I adds the next causal link:

```text
PROCEDURAL RESPONSIBILITY
→ POSITION REQUIREMENT
→ NAMED POSITION FAILURE
→ PROCEDURE-AUTHORIZED MOVEMENT REQUEST
→ SCHEDULED REPOSITION ACTION
→ LOCOMOTION EXECUTION
→ ACCEPTED POSITION
→ CONTINUED RESPONSIBILITY
```

## Why movement exists now

Movement is not a background preference and does not begin because another point has a slightly higher generic score. It exists because an operator has a persistent responsibility that cannot be adequately fulfilled from the current position.

In the Observation fixture:

- Northline Alternate Security begins with hard cover blocking the assigned alternate approach.
- Commune Local Security begins with hard cover blocking the assigned flank approach.
- Primary observers and reserves already satisfy their responsibilities and receive no movement authorization.

Only the two deficient security roles may relocate.

## Ownership

### Procedure runtime

Owns whether relocation is permitted for the active procedure. It does not select a destination or start movement.

### Role fulfillment data

Defines the position qualities required by that responsibility:

- useful sector visibility;
- useful sector coverage;
- team-cohesion limit;
- friendly spacing;
- fixture-zone compliance;
- maximum permitted relocation distance.

### Position query service

Describes current and candidate positions. It answers questions but does not assign destinations or move actors.

### Role position runtime

Recognizes that the current position fails a responsibility, evaluates suitable alternatives, requests a temporary destination claim, and proposes `RepositionForResponsibility` to the scheduler.

### Destination claim service

Owns temporary movement destinations so two actors cannot select nearly identical points.

### Action scheduler

Remains the only authority that starts, completes, interrupts, or cancels the movement action.

### Locomotion executor

Is the only V2 layer allowed to invoke physical actor movement. Tactical reasoning never writes coordinates or velocity directly.

## Action coexistence

`RepositionForResponsibility` occupies only the locomotion channel. The actor's existing `ObserveSector` action remains active through the movement. This preserves the responsibility and its provenance rather than cancelling and recreating observation.

While repositioning:

```text
PRIMARY ACTION
RepositionForResponsibility

CONCURRENT ACTION
ObserveSector
```

After arrival, the movement action completes and `ObserveSector` becomes the primary action again without being restarted.

## Stability

An accepted position remains valid until a meaningful invalidation occurs. A merely better-scoring position does not cause another move.

Meaningful future invalidations may include:

- assigned sector changes;
- procedure or role changes;
- hard obstruction changes;
- team-cohesion limit is broken;
- another actor makes the position unusable;
- immediate danger creates an authorized interrupt.

Build 2.0I only exercises the initial position failure and stable acceptance path.

## Deliberately excluded

2.0I does not add:

- hostility;
- target selection;
- aiming or firing;
- combat cover selection;
- generalized tactical pathfinding;
- squad-wide movement;
- continuous position optimization.
