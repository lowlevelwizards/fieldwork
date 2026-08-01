# Fieldwork 1.2D

## Team Combat Context & Cover Network

- Added one primary combat context per team so pairwise encounters no longer overwrite the final plan and threat direction.
- Added directional hard/soft cover nodes with protected and firing-edge positions.
- Exposed combatants now seek cover during active contact, route through intermediate cover when practical, and return behind cover after bursts.
- AI checks shot obstruction before firing and shifts toward a firing edge instead of wasting normal bursts into cover.
- Reloading operators prefer assigned protected positions.
- Nearby support teams choose covered support destinations.

# Changelog

## 0.5A.0 — Care Under Pressure

- Added the first authored incident: Ada injured beside the maintenance truck.
- Added actor conditions, needs, assessment, stabilization, recovery, and gentle deterioration.
- Made bandages and water usable on a nearby actor while held.
- Added assisted movement from the truck to the break table.
- Made the radio battery installable in the field-radio cradle.
- Added incident outcome tracking and world-state reactions.
- Added injury posture, blood evidence, objective updates, event hooks, and debug readouts.
