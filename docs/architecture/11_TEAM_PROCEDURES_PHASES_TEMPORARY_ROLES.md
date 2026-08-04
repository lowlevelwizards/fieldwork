# Team Procedures, Phases & Temporary Roles

Build 2.0G adds the next causal link:

```text
TEAM RESPONSE
→ PROCEDURE
→ PHASE
→ TEMPORARY RESPONSIBILITIES
→ PERMISSIONS
```

A response states what the team intends to do. A procedure states how the team will organize that intention. A role is a temporary responsibility required by the procedure, not a permanent character class.

## Ownership

The team procedure runtime owns:

- the active procedure;
- the current phase;
- temporary role assignments;
- procedure-level permissions;
- reassessment triggers;
- deliberate reassignment when a role holder becomes incapable.

It does not:

- start actor actions;
- turn or move actors;
- choose cover;
- select targets;
- fire weapons;
- alter personal or shared knowledge.

The actor layer will interpret these responsibilities in a later build.

## Security Watch

Selected from Northline's `Heighten Watch` response.

Roles:

- **Primary Observer** — maintain attention on the reported contact sector and report changes.
- **Alternate Security** — watch an uncovered approach so the team does not fixate on one uncertain contact.
- **Team Reserve** — remain available for communication, assistance, or a later response.

Phases:

```text
Establish Responsibilities
→ Maintain Watch
→ Reassess
```

## Concealed Observation

Selected from the Commune's `Maintain Concealment` response.

Roles:

- **Concealed Observer** — maintain contact awareness without exposing the team.
- **Local Security** — watch for discovery or movement toward the concealed position.
- **Withdrawal Reserve** — preserve the rear option and remain available for casualty or withdrawal support.

Phases:

```text
Establish Responsibilities
→ Maintain Contact
→ Reassess
```

## Stability

Assignments persist until a meaningful invalidation:

- the selected response changes or disappears;
- an assigned actor becomes incapable;
- the mission changes;
- contact evidence becomes stale;
- hostile action or detection requires reassessment.

Role assignment is deterministic and exclusive. One actor cannot occupy two primary procedural roles at once. An unavailable responsibility remains explicitly unfilled rather than silently duplicating an actor.

## Current boundary

2.0G intentionally stops before new actor behavior.

The existing observers continue their authored `ObserveSector` actions. Newly assigned security and reserve actors remain physically still. The procedure creates obligations and permissions, but only the future actor-decision layer may propose actions that fulfill them.
