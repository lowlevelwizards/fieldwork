# 23 — Unified Actor Brain and Execution Gateway

## Authority contract

Authority does not mean several controllers competing to move one body. Higher layers publish constraints and desired effects; the actor brain chooses a coherent physical plan; execution remains exclusive by channel.

```text
operation purpose
team concerns and legacy responsibilities
personal evidence and tactical picture
                 ↓
         UnifiedActorBrain
                 ↓
         ActorActionArbiter
                 ↓
          ActionScheduler
                 ↓
      narrow physical executors
```

## Candidate producers

Candidate producers may inspect their own domain and propose an atomic action. They may not call the scheduler directly. A proposal includes:

- actor and action;
- score and urgency;
- authority tier;
- source and reason;
- governing mission/procedure/role identifiers when applicable;
- concern and desired-effect identifiers when available.

## Plan comparison

For every conflicting active action, the brain evaluates:

1. interruptibility;
2. authority tier;
3. incumbent continuation utility;
4. candidate utility;
5. urgency advantage;
6. switch margin.

A candidate cannot replace a stronger valid incumbent merely because it was evaluated later in the frame. Immediate survival retains the ability to override lower authority.

## Channel composition

One plan can contain compatible actions, such as locomotion plus attention or communication. Candidates competing for the same channel are ranked once and only the strongest compatible set is forwarded.

## Scheduler boundary

`ActorActionArbiter` is the sole caller of `ActionScheduler.start`. The unified brain may request cancellation during a cross-type replan, but lower behavior runtimes publish cancellation requests rather than mutating execution directly.

## Transitional status

3.1C–D still adapts legacy agenda, response, procedure, and role outputs into brain proposals. It does not yet complete the 3.1E+ replacement of exact-point locomotion, role choreography, and concern staffing. Its purpose is to establish one trustworthy control seam before those systems are replaced.
