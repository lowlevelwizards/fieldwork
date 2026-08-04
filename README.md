# Fieldwork 2.0P — Actor Initiative & Protective Breakaway

Fieldwork is an isometric extraction-survival prototype about small teams doing necessary work in an unstable conflict zone.

Build 2.0P preserves Legacy 1.2H and extends the causal AI V2 foundation through the first bounded combat behavior. A physical hostile act now creates personal threat evidence, an operator may react and report before team deliberation is complete, and the team can organize a finite protective breakaway instead of entering an unrestricted firefight.

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

### Hostile Contact & Protective Breakaway

```text
physical hostile event
→ personal threat evidence
→ immediate operator initiative
→ urgent local report
→ shared hostile encounter
→ Break Contact Under Fire
→ Protective Breakaway
→ bounded protective fire and staged movement
→ contact broken
→ persistent outcome memory
```

## 2.0P proof

- Added personal threat knowledge grounded in a physical near-miss rather than faction identity.
- Added action priority, interruptibility, and explicit scheduler preemption.
- Added `ReactToIncomingFire` as an immediate individual action that can occur before team coordination.
- Reused local voice reporting to promote only the approximate threat information the operator personally knows.
- Added **Break Contact Under Fire** and **Protective Breakaway**.
- Added Lead Mover, Protected Mover, and Covering Operator responsibilities.
- Added deterministic, finite `ProtectiveFire` execution with ammunition consumption and friendly-line rejection.
- Reused the existing staged withdrawal action and destination-claim system for all three breakaway movements.
- Added `contact_broken_under_fire` outcome memory.
- Preserved the observation, warning, silent-withdrawal, casualty-recovery, adaptive-evacuation, and Legacy-runtime chains.

## Behavior Lab fixtures

1. Open Contact — complete personal-threat, urgent-report, bounded-fire, and protective-breakaway chain
2. Observation & Concealment — complete warning, withdrawal, and de-escalation chain
3. Cover & Position — staged and inert in V2
4. Casualty Recovery — complete recovery, adaptive evacuation, reassignment, and safe-return chain

Run the committed checks with:

```bash
npm test
```

See `docs/architecture/20_ACTOR_INITIATIVE_PROTECTIVE_BREAKAWAY.md` for the actor-authority, scheduler-preemption, bounded-fire, procedure, and explicit-scope contracts.
