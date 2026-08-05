# AI 3.1A–B — Behavioral Truth and Concurrent Team Concerns

This build begins the replacement of the legacy single-agenda control middle without changing physical behavior authority yet.

## 3.1A — Behavioral truth fixtures

Isolated action tests remain useful, but they cannot prove that a team behaves coherently over time. `BehavioralTruthMonitor` records long-running observable outcomes from the same live simulation used by the game:

- actor distance, stationary time, action switching, and direction reversals;
- actor overlap and cover-cluster congestion;
- opposing-team minimum distance, close-contact time, close-contact nonreaction, and static contact time;
- casualty attendance, targeted recovery actions, transport, evacuation, and unattended time;
- changes in each team's simultaneous concern set.

The monitor is diagnostic only. It does not score actions or alter the runtime.

Run the baseline suite with:

```text
npm run behavior:report
npm run behavior:report -- --json
```

The default report deliberately surfaces current failures rather than hiding them. A red behavioral signal is evidence for the 3.1 unified-brain migration, not a reason to weaken the monitor.

## 3.1B — Concurrent team concern board

`TeamConcernBoard` projects independent obligations from current physical and interpreted evidence:

```text
mission progress
hostile or uncertain contact
friendly casualty
safe return
```

Each concern contains:

- stable identity and subject;
- importance, urgency, and confidence;
- desired effect;
- evidence and approximate location;
- permissions and prohibitions;
- minimum/preferred staffing needs;
- the current legacy agenda, response, procedure, and phase that happen to project onto it.

Concerns persist independently. A warning response changing to heightened watch cannot erase a casualty concern. A casualty becoming urgent cannot erase mission progress. A return obligation can coexist with unresolved work or hostile pressure.

## Authority boundary

The concern board is explicitly non-authoritative in 3.1B:

```text
evidence and legacy state
→ concurrent concern projection
→ diagnostics and truth fixtures only
```

It does not:

- start actions;
- assign roles;
- pause operations;
- select a governing response;
- replace procedures;
- write locomotion, attention, stance, hands, or weapon state.

This lets the next build introduce one unified actor brain against a stable, observable set of simultaneous obligations while the old runtime remains available as a behavioral baseline.
