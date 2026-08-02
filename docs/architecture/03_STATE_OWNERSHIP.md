# State Ownership Rules

The primary architectural rule is simple:

> Every mutable decision has one owner.

## Physical state

Only mechanical executors may modify:

- actor position and velocity;
- path progress;
- weapon readiness, burst state, reload progress, and ammunition;
- treatment progress and medical supply consumption;
- interaction progress and object state;
- transmitted communication events.

## Actions

Only the action scheduler may:

- start an action;
- mark an action active;
- interrupt, cancel, fail, or complete an action;
- assign or release action channels;
- identify the readable primary action.

## Team decisions

Only the team brain may choose:

- the current team response;
- mission continuation, adaptation, or abort;
- the active tactical procedure;
- team-level tactical constraints.

## Procedure state

Only the procedure runtime may:

- advance procedure phases;
- assign temporary procedural roles;
- grant procedure-specific permissions;
- declare procedure completion or failure.

## Personal decisions

Only the actor brain may:

- rank local action proposals;
- select personal target preference;
- request an exact local position within team constraints;
- identify an immediate opportunity or danger interrupt.

The actor brain proposes. The scheduler decides whether the proposal runs.

## Reservations

Only the reservation service may grant, transfer, expire, or release:

- cover slots;
- firing edges;
- casualty ownership;
- interaction positions;
- narrow route access;
- objective work positions.

## Knowledge

Only perception may create direct observations.

Only communication may transfer private observations into another actor’s or team’s knowledge.

Only memory and inference systems may create remembered or inferred beliefs, and their source must remain explicit.

## Assessment

Assessment systems describe conditions. They do not command.

Examples:

- fight assessment may report positional disadvantage;
- casualty assessment may report urgency;
- route assessment may report that extraction is threatened.

The relevant decision owner chooses what to do with the report.

## Spatial services

Cover, path, visibility, and line-of-fire services answer queries. They do not assign behavior or move actors.

## Doctrine

Doctrine changes priorities, procedure preferences, risk tolerance, communication discipline, persistence, and resource budgets.

Doctrine does not bypass ownership rules.

## Diagnostics

Every action and phase transition records:

- what changed;
- which owner changed it;
- why it changed;
- what evidence was used;
- whether it completed, failed, or was interrupted.

A stall monitor diagnoses the specific blocked action. It must not blindly clear unrelated context.
