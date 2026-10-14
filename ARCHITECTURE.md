# Fieldwork Architecture

This document records the current source-of-truth boundaries so future changes do not recreate the duplicate-source problem removed in 1.3A.

## 1. Canonical runtime

There is one browser runtime source tree:

```text
index.html -> js/main.js -> js/continuous-game-state.js -> js/game.js + subsystems
```

Rules:

- Runtime JavaScript lives under `js/`.
- Static game definitions live under `data/`.
- Root-level JavaScript gameplay copies are not permitted.
- Gameplay/system JavaScript is not permitted under `data/`.
- Git history is the archive. Do not keep `old`, `backup`, `legacy-copy`, or parallel version folders in the active tree.

## 2. Data boundary

`data/` currently contains four canonical data modules:

- `items.js` — item definitions.
- `map.js` — map dimensions and map data.
- `operator-kits.js` — operator/faction kit definitions.
- `operators.js` — player/operator definition.

If a module owns behavior, updates per frame, mutates simulation state, renders, accepts input, or coordinates another system, it belongs in `js/`, not `data/`.

## 3. Runtime composition

### Browser/UI layer

`js/main.js` owns browser startup, DOM/UI bindings, input presentation, frame scheduling, debug readouts, and top-level game/renderer instances.

### Base world layer

`js/game.js` owns the foundational world state: map, entities, actors, places, operator, inventory, interaction, incident/excursion/operation controllers, world clock/weather, collision helpers, and common update behavior.

### Continuous simulation layer

`js/continuous-game-state.js` composes the larger simulation used by operations and the combat sandbox. It wires together perception, faction encounters, team combat context, cover systems, fire teams, combat posture, AI combat, wounds, medical behavior, actor intents, tactical fronts, and related systems.

The order of these updates is gameplay logic. Until explicit simulation phases are introduced, changes to update ordering must be treated as behavior changes and reviewed carefully.

## 4. Authority principles

The existing code already points toward a useful authority chain:

```text
world truth
  -> imperfect perception / contact knowledge
  -> team threat and plan context
  -> individual system proposals
  -> ActorIntent arbitration
  -> action/movement execution
  -> presentation
```

Preserve these distinctions when extending systems.

### Movement

Actor Intent is the preferred authority for competing AI movement requests. Avoid adding new systems that directly fight over actor velocity/targets when an intent proposal can express the same decision.

### Health

The wound/medical model should become the canonical source of health truth. Older incident compatibility flags may mirror that truth temporarily, but new features should not add additional parallel dead/unconscious/wounded representations.

### Team tactics

Pairwise encounter/contact records are evidence. Team combat context should remain the authority for a team's primary threat, current tactical plan, and front.

### Presentation

Rendering reads simulation state. Presentation code should not determine simulation outcomes.

## 5. Current high-value systems to preserve

These are foundations to refactor incrementally rather than replace wholesale:

- `ActorIntentSystem`
- `TeamCombatContextSystem`
- perception/contact knowledge
- wound and medical systems
- Living Operations concept
- physical item custody/inventory
- combat sandbox
- Canvas 2D presentation approach
- Ada and North Culvert as reference scenarios

## 6. Known stabilization debt

The next cleanup work should focus on:

1. Remove hand-maintained cache/version query strings from internal ES-module imports and centralize cache busting at the entry/deploy boundary.
2. Add formatting, linting, static import validation, and CI.
3. Introduce one simulation clock for gameplay timers.
4. Introduce seeded game randomness for reproducible failures.
5. Build a headless simulation runner and scenario smoke tests.
6. Add invariant checks for actor/entity/medical/combat state.
7. Create a canonical actor initializer/state shape.
8. Centralize line-of-sight, ray, collision, and related spatial queries.
9. Formalize simulation phases before changing subsystem order.
10. Split oversized systems only after their behavior is protected by tests.

## 7. Change discipline

For stabilization work:

- Prefer one conceptual change per build.
- Preserve gameplay unless the build explicitly targets behavior.
- Delete dead copies instead of maintaining compatibility with them.
- Do not introduce a new engine, ECS, behavior-tree framework, or TypeScript rewrite as a cleanup shortcut.
- Validate the canonical runtime after each structural change before proceeding to the next layer.
