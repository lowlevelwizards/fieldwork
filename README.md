# Fieldwork 2.0L — Silent Withdrawal & De-escalation

Fieldwork is an isometric extraction-survival prototype about small teams doing necessary work in an unstable conflict zone.

Build 2.0L preserves Legacy 1.2H and completes the first nonviolent AI V2 encounter inside the intentional Behavior Lab.

## AI runtimes

- **Legacy 1.2H** — the preserved combat and medical AI research prototype.
- **AI V2 — Silent Withdrawal** — teams observe, report, interpret mission interference, establish a boundary, react to a warning, disengage in stages, recognize de-escalation, and remember the result without omniscience or combat.

## 2.0L vertical slice

In Fixture 02, Northline detects a mission-relevant armed presence and issues one stop-and-identify warning. The Commune concludes that its concealed watch is compromised and selects **Withdraw Silently** rather than replying or escalating.

The V2 chain is now:

```text
warning heard
→ team reassessment
→ Withdraw Silently response
→ Break Contact Quietly procedure
→ Withdrawal Lead / Protected Mover / Rear Watch
→ staged WithdrawToRoute actions
→ observed departure
→ Monitor Departure response
→ Boundary Restored
→ encounter outcome memory
```

The Commune withdraws in three deliberate stages along an authored route. Northline observes the group leaving, holds its boundary, and does not pursue or repeat the warning. Both teams retain different evidence-grounded memories of the encounter.

The slice reuses the existing response, procedure, role, scheduler, destination-claim, locomotion, observation, activity-classification, and knowledge systems. It does not introduce a parallel squad-movement or negotiation framework.

## Behavior Lab fixtures

1. Open Contact
2. Observation & Concealment
3. Cover & Position
4. Casualty Recovery

Only Observation & Concealment currently runs the full V2 reasoning chain. The other fixtures remain inert until their own architectural needs justify behavior.

See `docs/architecture/16_SILENT_WITHDRAWAL_DEESCALATION.md` for ownership and scope.
