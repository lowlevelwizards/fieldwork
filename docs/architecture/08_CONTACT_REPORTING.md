# Contact Reporting and Shared Team Knowledge

## Purpose

Build 2.0D answers the discrepancy created by 2.0C:

```text
One observer knows something.
Nearby teammates do not.
Useful coordination requires deliberate communication.
```

The build proves that knowledge moves through an action and an executor rather than appearing automatically in a team-wide contact list.

## Causal chain

```text
PERSONAL OBSERVATION
→ information is credible enough to matter
→ ReportContact action begins
→ local voice transmission takes time
→ valid nearby recipients receive the report
→ each recipient gains second-hand knowledge
→ the team can derive a shared reported contact
```

The chain stops there. No encounter or response is selected.

## Authored reporting policy

The Observation Watch assignment supplies:

- communication method;
- local voice range;
- minimum confidence required before reporting;
- the reason the observer is expected to share the contact.

The actor does not invent a reporting doctrine. It performs a responsibility already justified by the mission and procedure.

## ReportContact owns

- the report's behavioral continuity;
- its source contact snapshot;
- communication progress;
- completion or failure;
- the list of recipients that actually received the message;
- the reason the report started.

It does not own:

- visual detection;
- whether the other group is hostile;
- team response selection;
- movement or cover;
- target selection;
- weapon use.

## Communication executor owns

- local voice range;
- transmission duration;
- speaker availability;
- recipient availability at delivery time;
- successful or failed delivery.

It does not decide whether information is important enough to report.

## Knowledge distinction

### Personal observation

The observer directly saw evidence. The record may be visible now or retained as memory.

### Received report

A teammate was told what the observer believed. The recipient knows:

- who reported it;
- what classification was reported;
- an approximate location;
- reduced confidence;
- when it was reported;
- that it is not personally confirmed.

### Team report

The team knowledge store is a derived record of delivered reports. It contains no information that was not communicated.

## Action channels

`ObserveSector` continues to occupy attention and stance.

`ReportContact` occupies communication. Local voice can coexist with observation, so the observer can keep watching while speaking. The scheduler presents ReportContact as the primary readable action while it is active, then returns to ObserveSector when delivery completes.

## Required behavior

In V2 mode with fixture 02 selected:

1. Exactly one observer per team forms private contact knowledge.
2. A report does not begin until confidence reaches the authored threshold.
3. The timed ReportContact action begins without ending ObserveSector.
4. Only same-team, conscious actors inside local voice range receive it.
5. Recipients retain second-hand knowledge with source and uncertainty.
6. The team report lists its actual recipients.
7. Unassigned teammates remain physically still.
8. No encounter, hostility, cover, or combat system activates.

## What this asks for next

```text
The team knows another group may be present.
But it does not yet know whether that group matters to the mission.
```

That asks for encounter recognition and mission incompatibility—not immediate threat response.
