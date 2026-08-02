# Fieldwork 2.0J — Observable Activity & Intent Hypotheses

Fieldwork is an isometric extraction-survival prototype about small teams doing necessary work in an unstable conflict zone.

Build 2.0J preserves Legacy 1.2H and advances the parallel AI V2 architecture inside the intentional Behavior Lab.

## AI runtimes

- **Legacy 1.2H** — the preserved combat and medical AI research prototype.
- **AI V2 — Activity & Intent** — teams observe, report, recognize mission interference, select responses, organize procedures, assign temporary roles, derive actor actions, reposition only when a responsibility requires it, and now perceive meaningful activity without gaining access to another actor's hidden purpose.

## 2.0J vertical slice

In Fixture 02, the two security operators still reposition once because their original locations cannot fulfill their assigned observation responsibilities. Opposing observers now perceive that movement as evidence rather than reading its true cause.

The V2 chain is now:

```text
personal observation
→ approximate contact track
→ meaningful activity classification
→ cautious intent hypothesis
→ ReportContactUpdate
→ communicated team knowledge
→ encounter reassessment
→ persistent response reaffirmation
```

Observable activity currently includes stationary, repositioning, approaching, withdrawing, observing, and lost contact. Intent remains explicitly uncertain: no clear intent, monitoring area, improving position, approaching an area of concern, leaving the area, or possible detection.

Activity reports communicate approximate evidence and confidence. They do not expose the other team's mission, procedure, temporary role, action provenance, or true reason for moving.

## Behavior Lab fixtures

1. Open Contact
2. Observation & Concealment
3. Cover & Position
4. Casualty Recovery

Only Observation & Concealment currently runs the V2 reasoning chain. Other V2 fixtures remain inert until their own architectural needs justify behavior.

See `docs/architecture/14_OBSERVABLE_ACTIVITY_INTENT_HYPOTHESES.md` for the new evidence and ownership boundaries.
