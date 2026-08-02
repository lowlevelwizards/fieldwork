# 2.0J — Observable Activity & Intent Hypotheses

## Why this layer exists

2.0I allowed an operator to move for a traceable internal reason: their current position could not fulfill an assigned responsibility. That movement created a new fact visible to the opposing observer.

An observer may see that a person moved, stopped, faced a direction, approached, withdrew, or disappeared. The observer may not read the person's temporary role, procedure, action provenance, or true reason for moving.

2.0J therefore adds the smallest evidence chain required to represent behavior over time:

```text
visible contact
→ approximate personal track
→ observable activity
→ cautious intent hypothesis
→ meaningful update report
→ shared team evidence
→ encounter reassessment
```

## Activity is not intent

**Activity** describes evidence available to the observer:

- stationary;
- repositioning;
- approaching;
- withdrawing;
- observing;
- lost contact.

**Intent** is an uncertain interpretation supported by that evidence:

- no clear intent;
- monitoring area;
- improving position;
- approaching area of concern;
- leaving area;
- possible detection.

The system must not convert one movement sample into authoritative hostility, attack, flanking, or knowledge of the target's mission.

## Personal contact track

A contact track belongs to one observer. It contains only approximate observed information:

- current and previous approximate positions;
- observed displacement and direction;
- estimated speed;
- approximate facing evidence;
- current activity and revision;
- short bounded activity history;
- current intent hypothesis and confidence;
- time of the latest meaningful change.

World-truth coordinates may be sampled by the sensor to produce evidence, but stored knowledge remains approximate and confidence-limited.

## Meaningful changes

A new activity revision is created only when evidence changes enough to matter, such as:

- movement beyond the uncertainty threshold;
- beginning to approach or withdraw;
- stopping after meaningful movement;
- appearing oriented toward the observer's area;
- losing visual contact.

Continued stationary observation does not produce repeated revisions or report spam.

## Communication

`ReportContactUpdate` is a real scheduled action. It occupies communication and transfers the observer's current belief, not world truth.

A delivered update includes:

- source operator;
- approximate current and previous positions;
- observed activity;
- activity confidence and age;
- cautious intent hypothesis;
- explicit second-hand and unconfirmed status.

Teammates do not receive an activity change until the communication action completes and they are valid recipients.

## Encounter reassessment

The team encounter layer may consume the latest communicated activity evidence and update its descriptive hypothesis. It may strengthen, weaken, or stale the perceived mission relevance.

It must not:

- declare hostility from movement alone;
- read the opposing procedure or role;
- start warnings, movement, aiming, or firing;
- directly change actor actions.

The existing response layer may reaffirm or eventually reconsider its response from changed evidence, subject to persistence rules. In this fixture, Northline continues **Heighten Watch** and the Commune continues **Maintain Concealment**.

## Ownership

- The visual sensor produces evidence.
- The personal-knowledge store owns the observer's contact track.
- The activity classifier describes meaningful visible change.
- The intent-hypothesis helper interprets evidence without asserting truth.
- The actor action layer proposes a report when an unreported meaningful revision exists.
- The scheduler owns the report action lifecycle.
- The communication executor determines recipients and delivers the report.
- Team knowledge owns second-hand activity reports.
- Encounter assessment interprets communicated evidence relative to the mission.
- No component in this chain moves actors or operates weapons.

## Deliberately excluded

- warnings and challenges;
- rules-of-engagement changes;
- hostility classification;
- target selection;
- aiming and firing;
- combat cover behavior;
- omniscient interpretation of another team's purpose.

## Success conditions

2.0J is successful when:

1. observers detect meaningful position and visibility changes over time;
2. tracks and reports use approximate observed information;
3. activity remains distinct from intent;
4. intent remains cautious and evidence-based;
5. hidden roles, procedures, missions, and action reasons never leak;
6. meaningful revisions create communication actions;
7. stable contacts do not generate repeated reports;
8. teammates receive only completed second-hand updates;
9. encounters reassess from communicated evidence;
10. no warning, hostility, target, aim, or fire behavior begins.
