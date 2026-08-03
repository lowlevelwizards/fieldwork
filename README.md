# Fieldwork 2.0O — Adaptive Evacuation & Safe Return

Fieldwork is an isometric extraction-survival prototype about small teams doing necessary work in an unstable conflict zone.

Build 2.0O preserves Legacy 1.2H and extends the causal AI V2 foundation through the first deliberately adaptive care procedure. A stabilized critical casualty now creates an evacuation obligation that can reprioritize the team, select a route from current world affordances, survive a carrier-capability failure, reassign responsibilities, and reach safety.

## AI runtimes

- **Legacy 1.2H** — the preserved combat and medical AI research prototype.
- **AI V2 — Adaptive Causal Runtime** — teams perceive incomplete facts, communicate, interpret mission problems, choose responses and procedures, assign responsibilities, and let individual operators select locally feasible actions that satisfy those responsibilities.

## Proven causal chains

### Observation & Concealment

```text
mission
→ personal observation
→ report
→ encounter interpretation
→ response and procedure
→ responsibility-driven movement
→ warning
→ silent withdrawal
→ de-escalation
→ resolved outcome memory
```

### Casualty Recovery & Evacuation

```text
friendly casualty perceived
→ personal casualty knowledge
→ report
→ Recover Casualty
→ assessment and assisted movement
→ stabilization
→ evacuation obligation
→ Evacuate Casualty
→ route affordance comparison
→ staged route security and transport
→ carrier capability loss
→ responsibility reassignment
→ transfer
→ safe return
```

Stabilization controls immediate deterioration. It does not restore a critical casualty to duty. Safe return resolves the local evacuation mission while preserving continued-care and field-unavailability consequences.

## 2.0O adaptive proof

- Added **Evacuate Casualty** as a response to the unresolved `evacuation_required` obligation.
- Added **Adaptive Casualty Evacuation** with Carrier, Route Security, and Rear Security responsibilities.
- Added route evaluation over multiple authored world affordances instead of one forced route.
- Added persistent route-selection, route-security, casualty-transport, reassessment, and transfer actions.
- Added capability-based role eligibility and scoring without actor-name or fixture-ID dependencies.
- Added a controlled mid-procedure capability loss. The patient is safely released, the invalid Carrier assignment is detected, responsibilities are reassigned, and the procedure resumes.
- Added safe-return outcome memory while keeping the casualty stable critical and unavailable for field duty.
- Added selected-route, active-leg, carrier-handoff, transfer, and safe-return presentation.
- Added deterministic tests for two different capability/route configurations using the same procedure.

## Behavior Lab fixtures

1. Open Contact — staged and inert in V2
2. Observation & Concealment — complete warning, withdrawal, and de-escalation chain
3. Cover & Position — staged and inert in V2
4. Casualty Recovery — complete recovery, adaptive evacuation, reassignment, and safe-return chain

Run the committed checks with:

```bash
npm test
```

See `docs/architecture/19_ADAPTIVE_EVACUATION_SAFE_RETURN.md` for the procedure, local-decision, failure-recovery, and sandbox-readiness boundaries.
