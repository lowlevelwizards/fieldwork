# Fieldwork 2.0M — Casualty Recovery & Stabilization

Fieldwork is an isometric extraction-survival prototype about small teams doing necessary work in an unstable conflict zone.

Build 2.0M preserves Legacy 1.2H and proves that the causal AI V2 architecture can coordinate care as well as uncertain encounters.

## AI runtimes

- **Legacy 1.2H** — the preserved combat and medical AI research prototype.
- **AI V2 — Casualty Recovery** — teams perceive, communicate, interpret mission problems, assign temporary responsibilities, execute physical actions through narrow authorities, and remember outcomes without omniscience.

## 2.0M vertical slice

Fixture 04 begins with a Commune operator critically wounded on exposed ground. A teammate must witness and report the casualty before the team can organize a response.

```text
friendly casualty perceived
→ personal casualty knowledge
→ local casualty report
→ Recover Casualty response
→ Casualty Recovery procedure
→ Aid Provider / Security Watch
→ approach
→ assess
→ drag to protected ground
→ stabilize
→ outcome memory
```

The Field Medic reaches the casualty, assesses their condition before treatment, drags them to an authored recovery point, and applies a pressure dressing through the existing wound system. The Security Watch preserves awareness throughout the recovery. Immediate bleeding stops, but the casualty remains critically impaired and still needs evacuation or further care.

The slice reuses the existing mission, encounter, decision, procedure, role, scheduler, destination-claim, locomotion, communication, observation, wound, and outcome-memory systems. It does not introduce a parallel medical AI or squad-movement framework.

## Behavior Lab fixtures

1. Open Contact
2. Observation & Concealment — complete nonviolent contact and withdrawal chain
3. Cover & Position
4. Casualty Recovery — complete recovery and stabilization chain

## Release hygiene

2.0M removes release-specific query strings from internal JavaScript imports. Only the top-level browser entry points remain build-versioned, so future changed-files packages should contain files whose behavior or documentation actually changed.

See `docs/architecture/17_CASUALTY_RECOVERY_STABILIZATION.md` for ownership and scope.
