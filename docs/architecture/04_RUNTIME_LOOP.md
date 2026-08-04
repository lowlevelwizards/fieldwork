# AI V2 Runtime Loop

AI V2 separates thinking from execution and advances larger decisions more slowly than physical simulation.

## Canonical order

1. **Capture world snapshot**
   - Read current physical state into a decision-safe representation.

2. **Produce observations**
   - Determine what each actor can currently perceive.

3. **Update personal knowledge**
   - Add observations, decay confidence, preserve source and uncertainty.

4. **Process communication**
   - Deliver voice, gesture, radio, and report events to valid recipients.

5. **Update needs, goals, and operations**
   - At strategic intervals or meaningful world events, recognize discrepancies and advance persistent operations.

6. **Update missions and tasks**
   - Translate operation phases into current team responsibility.

7. **Evaluate encounters**
   - Determine whether another intention, group, or hazard obstructs the task.

8. **Choose team response and advance procedure**
   - Select or continue a response, then advance its phased coordination.

9. **Generate actor action proposals**
   - Each actor considers personal knowledge, responsibility, danger, condition, equipment, and opportunity.

10. **Schedule actions**
    - Start, combine, continue, interrupt, fail, or complete actions through explicit channels.

11. **Execute actions**
    - Locomotion, weapons, hands, attention, stance, communication, treatment, and interaction advance physically.

12. **Resolve consequences**
    - Apply damage, wounds, resource use, object changes, detection, influence, and operation effects.

13. **Persist memory and new facts**
    - Record what remains relevant to actors, teams, factions, and the world.

## Frequencies

- Physical execution: every frame.
- Actor action evaluation: several times per second or on meaningful interrupts.
- Team procedure evaluation: at phase events plus a slower safety interval.
- Mission and operation evaluation: on meaningful events and low-frequency updates.
- Faction strategy: much slower than active tactical simulation.

## Foundation runtime in Build 2.0A

The first V2 runtime is intentionally observational.

It:

- captures read-only world snapshots;
- owns an empty action scheduler;
- records decision and invariant events;
- exposes a debug summary;
- does not import or update legacy tactical brains;
- does not yet assign actions to NPCs.

This proves the boundary before behavior is ported or rewritten.
