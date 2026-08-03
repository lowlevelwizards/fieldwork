# Fieldwork 2.0N — AI V2 Consolidation & Regression Harness

Fieldwork is an isometric extraction-survival prototype about small teams doing necessary work in an unstable conflict zone.

Build 2.0N preserves Legacy 1.2H and consolidates the causal AI V2 foundation after it proved two distinct complete behaviors: a nonviolent warning/withdrawal encounter and coordinated casualty recovery.

## AI runtimes

- **Legacy 1.2H** — the preserved combat and medical AI research prototype.
- **AI V2 — Consolidated Causal Runtime** — teams perceive, communicate, interpret mission problems, select responses, assign temporary responsibilities, execute persistent actions through narrow authorities, and remember consequences without omniscience.

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

### Casualty Recovery

```text
friendly casualty perceived
→ personal casualty knowledge
→ report
→ Recover Casualty response
→ Aid Provider / Security Watch
→ approach
→ assessment
→ assisted movement
→ stabilization
→ ongoing evacuation obligation
```

Stabilization controls immediate deterioration. It does not restore a critical casualty to duty. The 2.0M recovery outcome is now explicitly **stable critical, non-ambulatory, evacuation required** rather than being marked as a fully resolved mission.

## 2.0N consolidation

- Added a dependency-free `npm test` regression suite for both completed V2 chains, fixture isolation, Legacy initialization, procedure transitions, syntax, imports, and module cycles.
- Moved procedure event transitions into procedure definitions so `TeamProcedureState` no longer contains procedure-specific branches.
- Extracted debug projection from the AI runtime, reducing the composition root while keeping its update order explicit.
- Split authored Behavior Lab fixture data and map geometry from fixture execution.
- Removed 19 verified unreachable duplicate JavaScript files from earlier layouts.
- Added `npm run cleanup` for patch-based installations that need those retired files removed.

## Behavior Lab fixtures

1. Open Contact — staged and inert in V2
2. Observation & Concealment — complete warning, withdrawal, and de-escalation chain
3. Cover & Position — staged and inert in V2
4. Casualty Recovery — complete recovery and stabilization chain with evacuation still required

Run the committed checks with:

```bash
npm test
```

See `docs/architecture/18_AI_V2_CONSOLIDATION_REGRESSION_HARNESS.md` for the consolidation boundaries and ownership rules.
