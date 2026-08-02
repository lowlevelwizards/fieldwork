# Behavior Lab

## Purpose

The Behavior Lab is the controlled test environment for Fieldwork AI V2.

It replaces the old combat sandbox, which mixed randomized patrol movement, three factions, reinforcement waves, cover, combat, wounds, treatment, and retreat in one continuously changing scene. That stress test was useful for the legacy research prototype but could not reliably answer why a specific behavior succeeded or failed.

The Behavior Lab follows one rule:

> One fixture should ask one primary architectural question.

## Fixture contract

Every fixture defines:

- a human-readable question;
- the behavior concepts it is meant to isolate;
- fixed terrain and starting positions;
- fixed teams, missions, tasks, roles, and facing;
- a fixed player observation position;
- no random destinations;
- no reinforcement waves;
- no director-authored movement after initialization.

The selected AI runtime is responsible for every decision after staging.

## Fixtures

### 01 — Open Contact

**Question:** What happens when two small teams recognize one another with no useful cover nearby?

Designed to isolate:

- recognition;
- reaction delay;
- opportunity fire;
- immediate exposure response;
- first movement toward safety.

### 02 — Observation & Concealment

**Question:** What can each team personally observe, and what remains uncertain behind concealment?

Designed to isolate:

- facing;
- sight lines;
- concealment;
- personal knowledge;
- information sharing.

### 03 — Cover & Position

**Question:** Can a team choose, occupy, and remain in useful positions without crowding or pacing?

Designed to isolate:

- directional cover;
- finite slots;
- firing utility;
- reservations;
- position persistence and invalidation.

### 04 — Casualty Recovery

**Question:** How does a team preserve a critical person while pressure threatens the mission?

Designed to isolate:

- casualty recognition;
- responder selection;
- security responsibility;
- access and dragging;
- treatment;
- continue-versus-withdraw reassessment.

## Runtime behavior

### AI V2 Foundation

Actors remain staged and still. This is intentional. V2 behavior must only appear when a new action, procedure, or knowledge system explicitly justifies it.

### Legacy 1.2H

The legacy tactical runtime can be used in the same controlled fixtures for comparison. Its decisions remain emergent, but the initial conditions no longer change randomly.

## Expansion rule

A new fixture should only be added when an existing behavior cannot be understood inside the current four.

Potential later fixtures include:

- controlled road crossing;
- assigned covering fire;
- fighting withdrawal;
- ambush and relocation;
- civilian escort under obstruction;
- mission continuation after casualty.
