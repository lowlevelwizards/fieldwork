# AI V2

AI V2 is a parallel clean architecture. It must not import legacy tactical authorities.

Build 2.0A contains only the foundation:

- a read-only world snapshot;
- an explicit persistent action lifecycle;
- action channels and scheduling;
- a bounded decision log;
- invariant monitoring;
- a selectable observer runtime.

The V2 observer intentionally does not assign NPC actions yet. Its purpose is to prove the runtime boundary before the damaged-relay vertical slice introduces behavior.

## Dependency direction

```text
AI V2 decision layers
→ explicit adapters
→ existing physical mechanics
```

Never:

```text
AI V2
→ legacy tactical brain
```

## First behavior milestone

The first behavior is the peaceful damaged-relay chain documented in `docs/architecture/05_RELAY_VERTICAL_SLICE.md`.
