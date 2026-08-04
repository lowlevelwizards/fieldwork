# Mission Relevance and Encounter Recognition

## Purpose

Build 2.0E answers the discrepancy created by 2.0D:

```text
The team has received a report about another armed group.
But presence alone does not explain whether that group matters.
```

The build introduces a narrow team-level assessment that compares communicated knowledge to an authored team mission. It creates an uncertain encounter hypothesis without declaring hostility or selecting a response.

## Causal chain

```text
DELIVERED TEAM REPORT
→ AUTHORED TEAM MISSION
→ MISSION CONCERN AREA
→ SPATIAL AND FUNCTIONAL RELEVANCE
→ TEAM ENCOUNTER HYPOTHESIS
```

The chain stops there.

## Authored team mission owns

- the team's objective;
- its immediate task;
- success and abort conditions;
- the area whose condition matters to the mission;
- how sensitive the mission is to another armed presence;
- the authored reason that such a presence may interfere.

It does not own actor actions, movement, cover, targeting, or weapons.

## Encounter assessment owns

- comparing a delivered report to the mission concern area;
- measuring report age and confidence;
- estimating mission relevance;
- classifying the current hypothesis;
- explaining which report and mission condition support that conclusion.

It does not own:

- hostility;
- enemy identity or intent;
- tactical response selection;
- procedure or role assignment;
- movement, cover, or firing.

## Encounter states

### NONE

No mission and communicated report currently support an encounter hypothesis.

### POSSIBLE

A report exists, but its relevance or confidence is not yet strong enough to support a mission conclusion.

### RELEVANT

The report is credible enough and spatially connected enough to affect the mission.

### POTENTIALLY INCOMPATIBLE

The reported armed presence currently occupies or affects something the authored mission explicitly depends upon.

This is not the same as hostile. Identity and intent remain unknown.

### STALE

The supporting report has become too old or uncertain to support a current conclusion. The team retains only encounter memory until it expires.

## Independent interpretations

Each team assesses the same physical situation through its own mission and communicated knowledge.

Northline interprets an unknown armed presence in the southern monitored approach as possible interference with approach security.

The Commune interprets an unknown armed presence around the northern patrol observation area as possible compromise of its concealed watch.

These are separate hypotheses. There is no omniscient shared encounter object.

## Required behavior

In V2 mode with fixture 02 selected:

1. Observation and local contact reports continue exactly as in 2.0D.
2. Each team reads only its successfully delivered reports.
3. Each team compares the best report to its own authored mission.
4. A mission-relevant encounter hypothesis appears with evidence, confidence, and reason.
5. Identity and intent remain unknown.
6. No response is selected.
7. All actors remain physically still.
8. As the report decays, the encounter becomes stale and is eventually forgotten.
9. No legacy encounter, cover, targeting, or combat authority runs.

## What this asks for next

```text
The team recognizes that another group may interfere with the mission.
But it has not chosen what to do about that interference.
```

That asks for a response decision ledger comparing mission value, team preservation, information certainty, position, time pressure, resource cost, and exit options.
