# 2.0C — Tasked Observation & Personal Knowledge

## Why this build exists

The first cognitive event in AI V2 is not hostility or target acquisition. It is a personally held observation created because an authored responsibility asks an actor to look.

```text
MISSION
→ TASK
→ PROCEDURE
→ ROLE
→ ACTION
→ SENSORY EXECUTION
→ PERSONAL KNOWLEDGE
```

The Observation & Concealment fixture supplies the upstream reason explicitly. Autonomous faction planning is not required yet.

## Authored chain

Each side has one designated observer.

- **Mission:** understand activity on the opposing approach.
- **Task:** determine whether another group is present.
- **Procedure:** Observation Watch.
- **Phase:** Observe.
- **Temporary role:** Observer.
- **Action:** ObserveSector.

The remaining actors stay unassigned and inert in V2.

## System boundaries

### Fixture data owns

- Mission wording.
- Task wording.
- Procedure and phase.
- Temporary responsibility.
- Observation sector.
- Reason the action is assigned.

### ObserveSector owns

- Persistent commitment to the authored observation responsibility.
- The attention and stance channels.
- Requesting attention execution.
- Requesting visual evidence.
- Passing valid evidence into personal knowledge.

### Attention executor owns

- Turning the actor's look direction.
- Updating body-facing presentation.
- The scanning pose.

It does not choose what to observe.

### Visual observation owns

- Distance testing.
- Field-of-view testing.
- Hard obstruction testing.
- Concealment penalties.
- Evidence strength.

It does not create team knowledge or decide hostility.

### Personal knowledge owns

- Private contact records.
- Approximate last-observed positions.
- Confidence accumulation.
- Visible/lost state.
- Confidence decay and forgetting.

A contact remains an **unknown armed person**. The actor does not yet receive exact faction identity merely because the simulation knows it.

## Deliberate exclusions

2.0C does not add:

- Contact reporting.
- Team-shared knowledge.
- Encounter recognition.
- Hostility classification.
- Target selection.
- Cover seeking.
- Weapon actions.
- Team response procedures.

The debug readout explicitly reports that team knowledge is empty.

## Success criteria

In V2 mode with fixture 02 selected:

1. Exactly one observer per team receives an ObserveSector action.
2. Each observer turns toward the authored sector.
3. Visibility depends on distance, field of view, obstacles, and concealment.
4. A visible opposing actor creates a private contact record.
5. Confidence increases while observation remains valid.
6. Losing sight changes the record from visible contact to memory.
7. Memory confidence decays rather than disappearing immediately.
8. No teammate receives the observation automatically.
9. No tactical or combat response occurs.
10. Diagnostics can trace mission → task → procedure → role → action → private knowledge.
