# 17 — Casualty Recovery & Stabilization

## Purpose

2.0M tests whether AI V2 can coordinate care through the same causal architecture already used for observation, warning, withdrawal, and de-escalation.

```text
visible friendly condition
→ personal casualty knowledge
→ communicated team evidence
→ mission-relative casualty problem
→ Recover Casualty response
→ Casualty Recovery procedure
→ temporary responsibilities
→ actor actions
→ physical care execution
→ stabilized outcome memory
```

## Fixture boundary

Fixture 04 contains one three-person Commune team:

- a witness who can see and report the casualty;
- a Field Medic with finite treatment supplies;
- a critically wounded operator who cannot self-move.

No active enemy is required. The fixture isolates recovery behavior before suppression, threat, or combat are allowed to complicate it.

## Knowledge

The witnessing operator receives approximate personal casualty knowledge from visible condition. Other teammates do not learn the casualty through direct global access. A `ReportCasualty` action uses the existing local-voice executor to create team evidence.

The aid provider later produces a close assessment containing condition, consciousness, mobility, bleeding, active wounds, and immediate treatment need. Assessment is knowledge; it is not treatment.

## Response and procedure

The existing team decision ledger evaluates casualty urgency, reachability, recovery-point availability, medical capability, and team preservation. It may select **Recover Casualty**.

That response creates **Casualty Recovery** with two temporary responsibilities:

- **Aid Provider** — reach, assess, move, and stabilize the casualty.
- **Security Watch** — preserve awareness of the recovery approach while care is performed.

Phases advance only from explicit action results:

```text
Establish Responsibilities
→ Reach Casualty
→ Assess Condition
→ Move to Recovery Point
→ Stabilize
→ Recovery Complete
```

## Actions and execution

- `ApproachCasualty` uses the existing locomotion executor and destination claims.
- `AssessCasualty` reads the existing wound system and shares the assessment.
- `DragCasualty` claims both the destination and patient, moves the responder through locomotion, and lets the casualty-care executor write the dragged patient position.
- `StabilizeCasualty` claims the patient and applies the treatment indicated by the current wound assessment.

Only one actor may control a patient at a time. Claims release on completion, cancellation, or failure.

## Outcome

Successful stabilization means immediate uncontrolled bleeding is stopped on protected ground. It does not mean the casualty is healthy, mobile, or ready to resume the mission.

The team stores an evidence-grounded `casualty_stabilized` outcome. The casualty also retains a personal recovery memory indicating that further evacuation or care is required.

## Explicit exclusions

2.0M does not add:

- active enemy behavior;
- suppression or covering fire;
- aiming or shooting;
- threat-aware route planning;
- full evacuation;
- revival to healthy status;
- a parallel medical decision engine;
- general squad formations.

## Release hygiene

Internal JavaScript imports no longer carry release-specific query strings. Browser cache invalidation remains at the top-level script and stylesheet references in `index.html`. This prevents untouched modules from appearing changed solely because a build number advanced.
