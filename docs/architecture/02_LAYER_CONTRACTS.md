# Architecture Layer Contracts

Each layer answers one size of question. It receives structured inputs and emits structured outputs. It may not reach downward to perform work owned by another layer.

## World simulation

**Question:** What is true?

Receives world initialization and resolved consequences.

Produces facts and conditions about places, routes, infrastructure, supplies, civilians, teams, information, influence, and danger.

Must not choose faction goals or actor behavior.

## Faction interpretation

**Question:** What matters to us, and what is missing?

Receives known world facts, faction values, doctrine, resources, and existing commitments.

Produces recognized needs and their urgency.

Must not allocate cover, select targets, or control teams tactically.

## Goal and operation planning

**Question:** What should change, and what organized method could change it?

Receives needs, strategic knowledge, resources, and available capabilities.

Produces testable goals and persistent operations.

Must not issue individual actions.

## Mission management

**Question:** What is this team responsible for?

Receives an operation assignment, team capability, route information, supplies, risk constraints, and time budget.

Produces the active mission, current task, success conditions, abort conditions, and extraction or return plan.

Must not control an actor’s exact path, target, or stance.

## Knowledge

**Question:** What does each participant believe?

Receives observations, reports, inferences, and memories.

Produces personal and shared beliefs with confidence, source, age, and uncertainty.

Must not promote private observations into team knowledge without communication.

## Encounter evaluation

**Question:** What is interfering with the task?

Receives mission intent, believed external intentions, hazards, relationships, and current access.

Produces incompatibility, obstruction, escalation, and available nonviolent or violent responses.

Must not begin combat automatically merely because hostile factions are nearby.

## Team decision

**Question:** Which response best serves the mission and team?

Receives mission value, team condition, enemy-disruption opportunity, position, information certainty, resource cost, time pressure, exit options, and doctrine.

Produces a chosen response and tactical constraints.

Must not directly mutate actor position, weapon, wounds, or inventory.

## Procedure runtime

**Question:** How will the team coordinate the chosen response?

Receives a response, current task, team members, known terrain and threats, and doctrine.

Produces procedure phase, temporary roles, permissions, constraints, and phase events.

Must not perform locomotion, shooting, treatment, or interaction.

## Actor brain

**Question:** What is the best meaningful thing I can do now?

Receives personal knowledge, role, procedure permissions, current action, body, equipment, local terrain, allies, danger, and opportunities.

Produces ranked action proposals with reasons.

Must not directly start actions or alter physical state.

## Action scheduler

**Question:** Which proposed actions may start, coexist, continue, interrupt, or end?

Receives action proposals, active actions, channel requirements, interruption policy, and reservations.

Produces active action state and lifecycle events.

Must not make strategic, mission, or tactical-purpose decisions.

## Mechanical executors

**Question:** How does an accepted action happen physically?

Receives active actions and mechanical context.

Produces progress, completion, failure, physical movement, shots, treatment, communication, or interaction effects.

Must not select goals, missions, procedures, targets, patients, or destinations.

## Consequence and persistence

**Question:** What changed, and what continues to matter?

Receives execution results and world rules.

Produces new facts, resource changes, wounds, knowledge, relationships, operation outcomes, and memories.

Must not hide material consequences from future simulation.
