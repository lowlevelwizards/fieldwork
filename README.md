# Fieldwork 2.0I — Position Requirements & Procedure-Authorized Repositioning

Fieldwork is an isometric extraction-survival prototype about small teams doing necessary work in an unstable conflict zone.

Build 2.0I preserves Legacy 1.2H and advances the parallel AI V2 architecture inside the intentional Behavior Lab.

## AI runtimes

- **Legacy 1.2H** — the preserved combat and medical AI research prototype.
- **AI V2 — Position Requirements** — teams observe, report, recognize mission interference, select responses, organize procedures, assign temporary roles, derive actor actions, and now relocate only when an assigned responsibility cannot be fulfilled from the current position.

## 2.0I vertical slice

In Fixture 02, Northline Alternate Security and Commune Local Security begin with hard cover blocking their assigned watch sectors.

Each operator now:

1. evaluates the current position against the responsibility;
2. records a named failure reason;
3. confirms the procedure permits relocation;
4. selects a suitable destination inside strict travel, cohesion, spacing, and fixture limits;
5. claims that destination;
6. begins `RepositionForResponsibility` through the action scheduler;
7. moves through the locomotion executor;
8. accepts the new position;
9. continues the same `ObserveSector` responsibility without action churn.

Primary observers and reserves remain stationary because their positions already serve their responsibilities.

## Behavior Lab fixtures

1. Open Contact
2. Observation & Concealment
3. Cover & Position
4. Casualty Recovery

Only Observation & Concealment currently runs the V2 reasoning chain. Other V2 fixtures remain inert until their own architectural needs justify behavior.

See `docs/architecture/13_POSITION_REQUIREMENTS_PROCEDURE_REPOSITIONING.md` for the new ownership boundaries.
