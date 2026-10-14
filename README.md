# Fieldwork 2.7 — Continuous Tactical Deliberation

Fieldwork is an isometric extraction-survival sandbox about persistent small teams doing necessary work in an unstable shared landscape.

The active development direction is **AI V2 — Adaptive Causal Runtime** on the `AI-2.0` branch. Legacy 1.2H remains available as a preserved comparison runtime, but new behavior work should extend the V2 authority chain rather than deepen the legacy combat stack.

Build 2.7 adds continuous tactical deliberation beneath team procedures and above physical execution. Operators combine personal perception, reported knowledge, suppression, wounds, cover, spacing, mission responsibility, and local tactical commitments while the existing authority arbiter remains the only path to physical control.

## Current authority chain

```text
faction operation chooses why
→ team mission / concurrent concerns choose what matters
→ procedure and staffing choose who owns each responsibility
→ personal and shared knowledge constrain what each actor can know
→ unified actor planning proposes how to satisfy obligations
→ the arbiter and scheduler alone grant physical control
→ locomotion / attention / stance / action services execute the result
```

The Live Sandbox includes persistent faction teams, operational geography, contact recognition, local cooperation and contention, casualty recovery, adaptive evacuation, tactical positioning, spectator controls, and long-running behavioral diagnostics.

## Repository health

- `js/` is the runtime source tree; `js/ai-v2/` contains the causal V2 runtime.
- `data/` contains world data plus committed Behavior Lab / Live Sandbox fixture definitions.
- `tests/` contains deterministic regression coverage.
- `tools/check-imports.mjs` validates the reachable module graph and rejects versioned internal imports.
- `tools/check-build-hygiene.mjs` keeps HTML build labels and asset revisions synchronized with the canonical `BUILD_ID` in `js/main.js`.
- `.github/workflows/ai-v2-checks.yml` runs the committed checks for AI V2 pull requests.

Run the full validation suite with:

```bash
npm test
```

Run the behavioral truth report with:

```bash
npm run behavior:report
```

The architecture contracts live under `docs/architecture/`. Treat those contracts and regression tests as part of the implementation, not optional documentation.

---

# Historical reference — Fieldwork 2.0P

Build 2.0P preserved Legacy 1.2H and established the causal AI V2 foundation through the first bounded combat behavior. A physical hostile act created personal threat evidence, an operator could react and report before team deliberation was complete, and the team could organize a finite protective breakaway instead of entering an unrestricted firefight.

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

See `docs/architecture/20_ACTOR_INITIATIVE_PROTECTIVE_BREAKAWAY.md` for the actor-authority, scheduler-preemption, bounded-fire, procedure, and explicit-scope contracts.
