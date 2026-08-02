# Procedure-Driven Actor Actions

Build 2.0H adds the next causal link:

```text
TEAM RESPONSE
→ PROCEDURE
→ PHASE
→ TEMPORARY ROLE
→ ACTOR ACTION PROPOSAL
→ SCHEDULER
→ ATTENTION EXECUTION
```

## Why this layer exists

Build 2.0G gave every operator a temporary responsibility, but procedures deliberately did not control bodies. That left a meaningful discrepancy: a responsibility existed without an individual action that fulfilled it.

2.0H introduces an actor-level interpretation layer. It reads the current role, procedure phase, permissions, mission, and shared knowledge, then proposes a local action. The procedure still does not start that action.

## Ownership

### Procedure runtime owns

- Active procedure and phase.
- Temporary role assignment.
- Responsibility statements.
- Permissions and reassessment triggers.
- A role's fulfillment need.

### Actor action evaluator owns

- Translating a fulfillment need into candidate actions.
- Explaining why a candidate serves the responsibility.
- Selecting the best available candidate for the current local context.

### Role action runtime owns

- Reconciling the selected proposal with the actor's current action.
- Preserving an already-valid action instead of restarting it.
- Releasing role-driven actions when the responsibility ends.
- Returning a preserved observer action to its authored task when that task remains valid.

### Scheduler owns

- Starting and cancelling actions.
- Channel conflicts.
- Action lifecycle history.

### Attention executor owns

- Physical facing changes.
- Scan and ready poses.

Neither procedures nor actor evaluators directly turn or move actors.

## First fulfillment needs

### Observe contact

Used by Primary Observer and Concealed Observer.

The actor proposes `ObserveSector` toward the reported contact sector.

### Observe alternate approach

Used by Alternate Security and Local Security.

The actor proposes `ObserveSector` toward a distinct uncovered approach rather than duplicating the primary observer.

### Hold rear ready

Used by Team Reserve and Withdrawal Reserve.

The actor proposes `HoldReady`, remains in place, faces the rear option, and preserves availability for a later procedure change.

## Seamless ownership transfer

The two original observers already possess persistent `ObserveSector` actions from the authored fixture task. When the procedure assigns them an equivalent observer role, 2.0H updates the action's provenance in place:

```text
Authored observation task
→ same action instance
→ procedure-role provenance
```

The action does not cancel, restart, flicker, or lose its contact memory.

## Provenance

Every role-driven action records:

- Mission.
- Response.
- Procedure.
- Phase.
- Role.
- Responsibility.
- Start reason.
- Ownership source.

This makes the full explanation inspectable:

```text
Observe alternate approach
because I am Alternate Security
because the team is executing Security Watch
because the team selected Heighten Watch
because an uncertain armed presence may interfere with the mission.
```

## Deliberate limits

2.0H does not add:

- Locomotion.
- Position selection.
- Cover queries or reservations.
- Hostility classification.
- Target selection.
- Aiming or firing.
- Warning behavior.

All actors remain at their starting coordinates. Only facing and persistent action state change.

## What this asks for next

An actor may now possess a valid responsibility and action while occupying a position that cannot fulfill it well.

That asks for:

```text
ACTION REQUIREMENT
→ POSITION ADEQUACY
→ PERMITTED REPOSITION REQUEST
→ MOVEMENT ACTION
```

The next movement build should begin only when an existing action can demonstrate that its current position is inadequate.
