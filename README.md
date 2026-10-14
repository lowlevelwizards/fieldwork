# Fieldwork

Fieldwork is a phone-first browser game prototype about working in a living landscape: helping people, moving supplies, responding to changing conditions, and dealing with the consequences when ordinary work becomes dangerous.

**Current runtime:** Fieldwork 1.2H — Reactive Fire, Engagement Momentum & Medical Recovery  
**Current stabilization line:** 1.3A — Repository Consolidation

The game runs directly in the browser with HTML, CSS, ES modules, and Canvas 2D. No build step is required for the current runtime.

## Current playable systems

- Authored opening incident around Ada, including assessment, treatment, assisted movement, water, and radio repair.
- North Culvert excursion with travel, obstruction handling, field reporting, and return flow.
- Living Operations crews that move and work independently of the player.
- Faction encounters, imperfect perception, team threat context, tactical fronts, suppression, cover use, fire teams, and combat posture.
- Wounds, bleeding, shock, unconsciousness, treatment, casualty rescue, and NPC medical behavior.
- Separate combat sandbox for systemic testing.
- Touch and keyboard controls with a Canvas 2D presentation layer and debug HUD.

## Repository layout

```text
index.html                  Browser entrypoint
styles*.css                 UI and presentation styles
combat-controls.css
presentation-isolation.css

js/                         CANONICAL runtime source
  main.js                   Runtime/UI bootstrap
  game.js                   Base world/game state
  continuous-game-state.js  Extended simulation composition
  presentation/             Focused rendering helpers
  ...                       Gameplay and simulation systems

data/                       DATA ONLY
  items.js
  map.js
  operator-kits.js
  operators.js

ARCHITECTURE.md              Source-of-truth and subsystem boundaries
CHANGELOG.md                 Stabilization and gameplay history
```

Historical gameplay copies that previously lived at repository root and inside `data/` were removed in 1.3A. Git history is the archive; do not recreate parallel source trees.

## Runtime path

```text
index.html
  -> js/main.js
      -> js/continuous-game-state.js
          -> js/game.js
          -> simulation subsystems
      -> js/renderer.js
```

If code changes gameplay behavior, it belongs under `js/` unless it is genuinely static game data.

## Controls

- Touch joystick or WASD: move
- Context button or E: interact/use
- Pack button or B: backpack
- Combat controls: aim/fire when available
- Escape: close panels
- Debug button: runtime diagnostics

## Development priorities

The stabilization sequence is intentionally conservative:

1. Keep `js/` as the single runtime source of truth.
2. Remove hand-maintained module cache-version drift.
3. Add format/lint/import validation and CI.
4. Add deterministic simulation time and seeded randomness.
5. Add headless scenario and invariant tests.
6. Consolidate actor state and shared spatial queries before deeper AI refactors.

Prefer small behavior-preserving builds over broad rewrites. The existing Actor Intent, team combat context, perception, medical/wound, Living Operations, and sandbox foundations should be evolved rather than replaced wholesale.
