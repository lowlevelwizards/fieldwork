# Legacy AI Runtime — Research Prototype 1.2H

## Status

The 1.2H AI is preserved as a working research prototype. It remains the default runtime in Build 2.0A so its behavior can be compared against the new architecture while AI V2 is built in parallel.

Do not add new broad behavior systems to the legacy runtime. Fix only defects that prevent the preserved build from loading or being used as a reference.

## Active runtime

The browser loads `js/main.js`, which creates `ContinuousGameState` from `js/continuous-game-state.js`.

The active implementation lives under `js/`. Root-level JavaScript files with matching names are older duplicates and are not the authoritative runtime.

## Legacy AI update order

Within `ContinuousGameState.update`, the legacy path currently advances:

1. Base game, incident, excursion, and operation updates.
2. Wounds and player combat.
3. Perception.
4. Faction encounters.
5. Team combat context and fight assessment.
6. Cover network and cover-state classification.
7. Fire-team roles and permissions.
8. Combat posture.
9. Team response.
10. Medical behavior.
11. AI combat.
12. Actor-intent resolution and movement.

## Active legacy AI modules

- `js/actor-state.js`
- `js/actor-motion.js`
- `js/actor-intent.js`
- `js/perception.js`
- `js/faction-doctrine.js`
- `js/faction-encounters.js`
- `js/team-combat-context.js`
- `js/fight-assessment.js`
- `js/fire-team-controller.js`
- `js/tactical-front.js`
- `js/cover-network.js`
- `js/cover-state.js`
- `js/combat-posture.js`
- `js/ai-combat.js`
- `js/team-response.js`
- `js/medical-system.js`
- `js/wound-system.js`

## Proven ideas worth carrying forward

- Capability checks based on bodily state.
- Personal perception, uncertain contact, and last-known information.
- Directional cover with finite capacity and firing edges.
- Team context, tactical roles, and suppression concepts.
- Persistent intent and interruption rather than frame-by-frame orders.
- Wounds, blood loss, shock, consciousness, dragging, and staged treatment.
- Reactive fire and tactically acceptable “good enough” shots.
- Explicit debug vocabulary such as posture, target, fire blocker, role, cover, assessment, and movement owner.

## Known architectural problems

- Several systems can propose or directly influence movement.
- Several systems can assign, replace, or release cover.
- `combat-posture.js` and `ai-combat.js` both operate the exposure and firing-position cycle.
- Fire-team roles exist without one authoritative phased procedure runtime.
- Medical behavior contains a second tactical decision system inside the broader AI.
- Actor fields are used interchangeably as facts, commands, outputs, locks, and inter-system messages.
- The movement intent arbiter runs after other systems have already changed tactical state.
- Watchdogs can erase useful context rather than repairing the specific failed action.
- Base operations can physically move actors before combat reasoning runs.
- Root-level duplicate JavaScript files and stale build documentation make ownership unclear.

## Legacy rule

The legacy runtime is evidence, not the foundation of AI V2.

Reuse isolated mechanics and calculations only through explicit adapters. Do not import legacy tactical authorities into `js/ai-v2/`.
