## Fieldwork 2.5 — Faction Contact Resolution & Hostile Contention

- Added spatially grounded opposing-team contact obligations.
- Added avoid, contest, and hostile-contact response options.
- Added physical circumvention/contest positioning through the authority arbiter.
- Added active spectator world bounds, free pan, wheel zoom, and pinch zoom.
- Disabled the player avatar in Live Sandbox observation mode.

# Fieldwork 2.4

## Team Recognition, Deconfliction & Local Cooperation

- Corrected Live Sandbox roster kits so Northline, Commune, and Freelancers use their real faction visual families instead of the generic fallback.
- Added faction-colored operator halos, persistent team labels, relationship links, a fit-map spectator camera, free pan/zoom, team cycling, and story-event focus.
- Added a shared relationship resolver used by warnings, firing-line safety, suppression, and encounter interpretation.
- Made separate teams from the same faction protected friendlies that cannot warn, suppress, shoot, or wound one another.
- Added team-contact understanding that aggregates observed operators into recognized teams with faction confidence, visible-operation hypotheses, distress state, and local interaction protocols.
- Added temporary pass-through, parallel-work, shared-security, and casualty-aid contracts without merging team missions or physical authority.
- Added authority-constrained inter-team spacing, cooperative objective assistance, and bounded cross-team stabilization actions.
- Preserved incompatible contested operations, warning/refusal, demonstrative fire, protective breakaway, persistent consequences, operational geography, and campaign saves.
- Added regressions for all-faction spawning, real faction kits, warning/fire safety, team recognition, deconfliction, compatible work, casualty aid, natural assistance, and continued armed contention.

# Fieldwork 2.0P

## Actor Initiative & Protective Breakaway

- Activated the Open Contact Behavior Lab fixture in AI V2.
- Added personal threat knowledge grounded in a physical hostile event without revealing exact shooter identity.
- Added action priority, interruptibility, and explicit scheduler preemption.
- Added `ReactToIncomingFire` for immediate operator initiative before team deliberation completes.
- Reused local voice reporting to promote only the approximate threat information personally perceived.
- Added **Break Contact Under Fire** and **Protective Breakaway**.
- Added Lead Mover, Protected Mover, and Covering Operator responsibilities.
- Added deterministic finite `ProtectiveFire` execution with ammunition consumption and friendly-line rejection.
- Reused staged withdrawal movement and destination claims for the complete break-contact sequence.
- Added `contact_broken_under_fire` outcome memory.
- Added GitHub Actions execution of syntax, import, cycle, and regression checks.
- Preserved Legacy 1.2H, observation/de-escalation, casualty recovery, physical carrier handoff, adaptive evacuation, and safe return.
- Kept target optimization, cover selection, pursuit, assault, flanking, morale, and unrestricted firefights out of scope.

# Fieldwork 2.0O.1

## Physical Carrier Handoff

- Added a dedicated evacuation-casualty approach action before patient custody can transfer.
- Prevented remote patient claims, drag attachment, and final transfer outside interaction range.
- Added a physical-layer drag guard that refuses impossible responder-patient distances.
- Added regression coverage proving the casualty remains stationary while a replacement carrier walks over to acquire them.

# Fieldwork 2.0O

## Adaptive Evacuation & Safe Return

- Continued the stabilized-casualty obligation into a complete safe-return outcome.
- Added **Evacuate Casualty** to the team response evaluator.
- Added **Adaptive Casualty Evacuation** with Carrier, Route Security, and Rear Security responsibilities.
- Added runtime route-affordance evaluation across multiple candidate extraction routes.
- Added `SelectEvacuationRoute`, `AdvanceRouteSecurity`, `EvacuateCasualty`, `ReassessEvacuationCasualty`, and `TransferCasualty` actions.
- Added capability-based role eligibility and preference scoring without actor-name or fixture-ID dependencies.
- Added transport stamina as a changing local capability rather than a fixed scripted handoff.
- Added safe patient, destination, drag, and locomotion release before reassignment.
- Added procedure-phase resumption after a responsibility becomes invalid and roles are deliberately reassigned.
- Added selected-route, active-leg, carrier-handoff, transfer, and safe-return presentation.
- Added `casualty_evacuated_alive` outcome memory with continued-care and field-unavailability consequences.
- Added deterministic regression variants proving the same procedure selects different routes and carrier order under different world/capability inputs.
- Preserved the complete warning/withdrawal/de-escalation chain, initial casualty-recovery chain, inert V2 fixtures, separate Legacy runtime, and zero combat behavior.

# Fieldwork 2.0N

## AI V2 Consolidation & Regression Harness

- Added a dependency-free Node regression suite covering the complete observation/warning/withdrawal chain and casualty-recovery chain.
- Added deterministic checks for fixture isolation, Legacy initialization, action order, treatment consumption, outcome semantics, syntax, import resolution, and module cycles.
- Moved procedure event transitions into `procedure-definitions.js`; `TeamProcedureState` now applies transitions generically.
- Extracted actor diagnostics and debug summaries from `AIV2Runtime` into `ai-debug-projection.js`.
- Reduced `ai-runtime.js` from 458 lines to roughly 250 while preserving its explicit causal update order.
- Split authored Behavior Lab fixture content into `data/behavior-lab-fixtures.js` and map geometry into `data/behavior-lab-map.js`.
- Corrected casualty outcome semantics: immediate deterioration is resolved, but the mission remains open with `evacuation_required`, `stable_critical`, and `non_ambulatory` state.
- Updated casualty presentation to show **STABILIZED · CRITICAL** and **EVACUATION REQUIRED**.
- Removed 19 verified unreachable duplicate JavaScript files left by earlier layouts.
- Added `npm run cleanup` for deleting those retired duplicates after applying a changed-files patch.
- Preserved both completed V2 fixture outcomes and the separate Legacy 1.2H runtime without adding new combat behavior.

# Fieldwork 2.0M

## Casualty Recovery & Stabilization

- Activated the Casualty Recovery Behavior Lab fixture in AI V2.
- Added personal friendly-casualty observation and evidence-grounded casualty reporting.
- Added **Recover Casualty** to the existing team response ledger.
- Added **Casualty Recovery** with Aid Provider and Security Watch responsibilities.
- Added persistent `ReportCasualty`, `ApproachCasualty`, `AssessCasualty`, `DragCasualty`, and `StabilizeCasualty` actions.
- Added exclusive patient claims so only one operator can physically control or treat a casualty at a time.
- Reused the existing locomotion executor and destination claims for approach and drag movement.
- Reused the existing wound system for assessment and pressure-dressing treatment.
- Preserved security observation while the aid provider performs care.
- Added an evidence-grounded `casualty_stabilized` outcome memory.
- Kept the casualty critically impaired after bleeding control; stabilization is not full recovery.
- Added recovery paths, casualty markers, action labels, procedure presentation, and diagnostics.
- Removed release-specific cache identifiers from internal JavaScript imports; only top-level browser assets remain versioned.
- Preserved the completed 2.0L observation/withdrawal chain and Legacy 1.2H runtime.

# Fieldwork 2.0L

## Silent Withdrawal & De-escalation

- Added an authored Commune withdrawal plan with one exit route, role-specific destinations, movement speed, spacing, and arrival requirements.
- Added **Withdraw Silently** as an evidence-gated team response after a directed warning is heard.
- Added **Break Contact Quietly** with Withdrawal Lead, Protected Mover, and Rear Watch responsibilities.
- Added staged procedure phases so one operator moves at a time while the rear watch preserves contact awareness.
- Added `WithdrawToRoute` as a persistent locomotion action using the existing scheduler, destination claims, and locomotion executor.
- Added observed-departure evidence without revealing the withdrawing team’s hidden response, procedure, roles, or motive.
- Added **Monitor Departure** so Northline holds its boundary and watches the group leave without pursuit or repeated warnings.
- Added terminal **Withdrawal Complete** and **Boundary Restored** phases with a short visible hold before returning to idle work.
- Added evidence-grounded outcome memories for both teams: `withdrew_without_reply` and `contact_departed_after_warning`.
- Added withdrawal paths, role indicators, outcome presentation, and encounter-outcome diagnostics.
- Preserved single-writer movement ownership and prevented destination churn, repeated withdrawals, pursuit, aiming, and firing.
- Preserved Legacy 1.2H as a separate runtime.

# Fieldwork 2.0K

## Boundaries, Challenge & Warning

- Added authored mission boundaries with explicit area, policy, evidence threshold, warning message, range, and duration.
- Extended the team decision ledger with boundary relevance, activity evidence, reversibility, and warning state.
- Northline now changes from **Heighten Watch** to **Issue Warning** only after credible activity evidence activates its monitoring boundary.
- Added `Challenge Unknown Contact` with Challenger, Primary Observer, and Alternate Security responsibilities.
- Added `IssueWarning` as a persistent actor action using communication and attention channels.
- Added directed raised-voice recipient checks using range and sector direction.
- Added personal heard-warning memories with approximate source location and no hidden mission or role data.
- Added incoming and outgoing warning evidence to encounter reassessment.
- Added explicit procedure events so a delivered warning advances to **Await Response** without repeating.
- Added warning presentation, communication lines, map markers, actor indicators, and diagnostics.
- Preserved Commune **Maintain Concealment** and excluded compliance, refusal, hostility, aiming, and firing.
- Preserved Legacy 1.2H as a separate runtime.

# Fieldwork 2.0J

## Observable Activity & Intent Hypotheses

- Added approximate personal contact tracks with short bounded histories.
- Added observable activity classification for stationary, repositioning, approaching, withdrawing, observing, and lost contact.
- Added cautious intent hypotheses that remain separate from observed activity.
- Added `ReportContactUpdate` as a persistent communication action for meaningful behavioral changes.
- Added second-hand activity reports to team knowledge without exposing hidden actor state.
- Added encounter reassessment from communicated activity evidence.
- Preserved team response persistence; new evidence may reaffirm or later invalidate a response but does not directly start behavior.
- Added activity and intent diagnostics, update indicators, approximate movement trails, and latest-report map presentation.
- Adjusted the Observation fixture so both primary observers can witness the security operators' one-time repositioning while the security responsibilities remain obstructed at their starting positions.
- Prevented stationary contacts from generating repeated update-report spam.
- Preserved the absence of warnings, hostility, target selection, aiming, and firing in AI V2.
- Preserved Legacy 1.2H as a separate runtime.
