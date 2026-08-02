# First Vertical Slice — Damaged Relay

The first AI V2 behavior will prove one complete causal chain without combat.

## Initial world facts

- Relay 14 exists.
- Relay 14 is damaged and not transmitting.
- Safehouse Cedar possesses one compatible repair component.
- A Commune team is available.
- Safehouse Cedar and Relay 14 are connected by a traversable route.

## Value

The Commune values communication between isolated communities and safehouses.

## Need

The believed current communication capacity is lower than the Commune’s desired connected capacity.

## Goal

```text
Relay 14 operational == true
```

The goal describes the desired result, not the method.

## Operation

Restore Relay 14.

Proposed phases:

1. Confirm required component.
2. Assign a capable team.
3. Collect component.
4. Travel to relay.
5. Install component.
6. Test transmission.
7. Return to Safehouse Cedar.

## Mission

Team Cedar must carry the repair component from Safehouse Cedar, restore Relay 14, verify transmission, and return.

Mission data:

- objective: restore Relay 14;
- route: Safehouse Cedar → Relay 14 → Safehouse Cedar;
- required item: relay repair component;
- time constraint: none in the first slice;
- risk tolerance: ordinary field travel;
- success: relay operational and test received;
- abort: component lost or no capable team member remains;
- return destination: Safehouse Cedar.

## Initial tasks

1. Collect component.
2. Travel to relay.
3. Repair relay.
4. Test relay.
5. Return.

## Initial actions

- `CollectItem`
- `MoveTo`
- `CarryItem`
- `RepairObject`
- `TestObject`
- `ReturnToLocation`
- `Wait`

## Consequences

On success:

- Relay 14 becomes operational.
- Commune communication capacity increases.
- The component is consumed or installed.
- Team time and supplies are updated.
- The operation becomes a persistent completed event.

On failure:

- Relay 14 remains damaged.
- The reason for failure is recorded.
- Any lost component, injury, delay, or route change persists.

## Deliberate omissions

The first slice does not require:

- enemies;
- combat;
- cover;
- suppression;
- faction-wide operation generation;
- generalized path planning;
- complex medical response.

Those systems will be added only when the functioning slice asks for them.
