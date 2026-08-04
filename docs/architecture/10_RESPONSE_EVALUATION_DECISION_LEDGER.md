# 2.0F — Response Evaluation & Decision Ledger

## The discrepancy

Build 2.0E allowed a team to recognize that a communicated contact may interfere with its mission:

```text
SHARED REPORT
→ MISSION RELEVANCE
→ POSSIBLE CONFLICT
→ NO RESPONSE SELECTED
```

Build 2.0F answers the next question:

> Given what the team believes, which reversible approach best serves the mission and preserves the team?

The output is a persistent **team response**, not an actor action and not a tactical procedure.

## Causal chain

```text
MISSION-RELEVANT ENCOUNTER
→ DECISION LEDGER
→ RESPONSE CANDIDATES
→ SELECTED TEAM RESPONSE
→ NO PROCEDURE ASSIGNED YET
```

## Decision ledger

The ledger keeps distinct concerns instead of compressing the situation into one combat-strength number:

- Mission value.
- Team preservation.
- Need for more information.
- Information certainty and uncertainty.
- Encounter relevance.
- Position security.
- Concealment value.
- Detection risk.
- Time pressure.
- Resource conservation.
- Exit options.
- Enemy-disruption value.
- Security, stealth, and mobility orientations.
- Evidence of hostile intent.

The current Behavior Lab values are authored mission context. The evaluator reads only the mission and the team's own encounter hypothesis. It does not inspect hidden enemy state or world truth.

## Response vocabulary

2.0F compares seven deliberately nonviolent responses:

- Continue Observation.
- Heighten Watch.
- Maintain Concealment.
- Wait.
- Warn.
- Reroute.
- Withdraw.

Each response defines named scoring considerations. Diagnostics retain every candidate score and the readable reason for the winner.

## Fixture outcomes

### Northline

The security mission values approach awareness, an established observation line, and active control. It selects:

```text
HEIGHTEN WATCH
```

The team remains in place, avoids escalation, and has no procedure yet.

### Commune

The concealed-watch mission values team preservation, concealment, optionality, and avoiding discovery. It selects:

```text
MAINTAIN CONCEALMENT
```

The team remains in place, avoids escalation, and has no procedure yet.

## Persistence

A response is not recalculated into a new answer every frame.

The response state owns:

- Selected response.
- Selection time.
- Candidate scores.
- Decision ledger.
- Reassessment interval.
- Minimum hold time.
- Switch margin.
- Invalidation reason.

It is reconsidered only on a scheduled reassessment or meaningful evidence change. A challenger must exceed the current response by the configured margin after the minimum hold period. Stale or missing encounter evidence invalidates the response.

## Ownership

### Team decision ledger

Describes the tradeoffs present in the team's current knowledge and mission.

It must not:

- Start actions.
- Move actors.
- Assign roles.
- Declare hostility.
- Inspect hidden world truth.

### Response evaluator

Compares response definitions against the ledger and returns scored candidates.

It must not:

- Execute the selected response.
- Select cover or targets.
- Create a tactical procedure.

### Team response state

Owns selection persistence, reassessment, switching, and invalidation.

It produces a team-level decision that the next layer may interpret.

## Deliberately excluded

2.0F does not add:

- Tactical procedures.
- Procedure phases.
- Temporary role assignment.
- New actor actions.
- Movement.
- Cover selection.
- Warnings being spoken.
- Aiming or firing.
- Hostility classification.

The next discrepancy is:

```text
The team selected a response.
But the response does not yet define coordinated responsibilities.
```

That asks for one small procedure runtime with phases and temporary roles.
