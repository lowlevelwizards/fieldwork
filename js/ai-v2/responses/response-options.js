const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

function term(id,label,value,weight,{invert=false}={}){
  const normalized=clamp(invert?1-value:value);
  return{id,label,value:normalized,weight,contribution:normalized*weight};
}

function scoreFrom(terms,base=0,bias=0){
  const raw=base+terms.reduce((sum,item)=>sum+item.contribution,0)+bias;
  return clamp(raw);
}

function option({id,label,summary,base=0,terms,reason,eligible=null}){
  return{
    id,label,summary,
    evaluate({ledger,mission,encounter}){
      if(eligible&&!eligible({ledger,mission,encounter}))return null;
      const contributions=terms(ledger);
      const bias=clamp(ledger.responseBias?.[id]??0,-.35,.35);
      const score=scoreFrom(contributions,base,bias);
      return{
        id,label,summary,score,bias,
        contributions:contributions.map(item=>({...item})),
        reason:reason(ledger),
        eligible:true
      };
    }
  };
}

const relevantEncounter=({encounter})=>encounter?.subjectKind!=="friendly_casualty"&&(encounter?.state==="relevant"||encounter?.state==="potentially_incompatible");
const friendlyCasualtyEligible=({ledger,encounter})=>encounter?.subjectKind==="friendly_casualty"&&ledger.recoveryPlanAvailable>0&&ledger.casualtyUrgency>0&&ledger.evacuationRequired<=0;
const casualtyEvacuationEligible=({ledger,encounter})=>encounter?.subjectKind==="friendly_casualty"&&ledger.evacuationRequired>0&&ledger.casualtyStabilized>0&&ledger.evacuationPlanAvailable>0;
const boundaryWarningEligible=({ledger,encounter})=>relevantEncounter({encounter})&&ledger.boundaryTrigger>0;
const silentWithdrawalEligible=({ledger,encounter})=>relevantEncounter({encounter})&&ledger.warningHeard>0&&ledger.withdrawalPlanAvailable>0;
const monitorDepartureEligible=({ledger,encounter})=>relevantEncounter({encounter})&&ledger.warningIssued>0&&ledger.departureEvidence>0;

export const TEAM_RESPONSE_OPTIONS=Object.freeze([
  option({
    id:"recover_casualty",
    label:"Recover Casualty",
    summary:"Organize security, reach the casualty, move them to protected ground, and stop immediate deterioration.",
    base:.18,
    eligible:friendlyCasualtyEligible,
    terms:ledger=>[
      term("urgency","the casualty is in immediate danger",ledger.casualtyUrgency,.28),
      term("preservation","recovering the casualty preserves the team",ledger.teamPreservation,.20),
      term("care_orientation","the mission explicitly values care under pressure",ledger.careOrientation,.18),
      term("mission_value","the recovery is the current mission",ledger.missionValue,.13),
      term("recovery_point","a protected recovery point is available",ledger.recoveryPlanAvailable,.09),
      term("medical_capability","the team has an aid provider and supplies",ledger.medicalCapability,.08),
      term("time_pressure","delay increases deterioration",ledger.timePressure,.08),
      term("resource_cost","treatment consumes a finite medical supply",ledger.resourceConservation,-.03)
    ],
    reason:ledger=>`A known teammate is in immediate danger, and ${ledger.exitLabel} provides a viable place to move and stabilize them while preserving security.`
  }),
  option({
    id:"evacuate_casualty",
    label:"Evacuate Casualty",
    summary:"Suspend the local task, select a viable safe-return route, transport the stabilized casualty, adapt responsibilities when capability changes, and reach extraction.",
    base:.22,
    eligible:casualtyEvacuationEligible,
    terms:ledger=>[
      term("evacuation_required","stabilization left an explicit evacuation obligation",ledger.evacuationRequired,.30),
      term("stabilized","immediate bleeding is controlled enough to move",ledger.casualtyStabilized,.14),
      term("route_options","the world offers viable extraction affordances",ledger.evacuationPlanAvailable,.14),
      term("preservation","safe return preserves the casualty and team",ledger.teamPreservation,.18),
      term("care_orientation","the mission values completing the rescue",ledger.careOrientation,.14),
      term("safe_return","reaching extraction completes the useful outcome",ledger.safeReturnValue,.12),
      term("mobility","the team can reorganize around transport",ledger.mobilityOrientation,.08),
      term("mission_suspension","the prior observation task is deliberately suspended",ledger.originalMissionSuspended,.05),
      term("resource_cost","transport consumes operator stamina and time",ledger.resourceConservation,-.04)
    ],
    reason:ledger=>`The casualty is stable enough to move but remains non-ambulatory; ${ledger.exitLabel} makes safe return the team's highest-value unresolved obligation.`
  }),
  option({
    id:"continue_observation",
    label:"Continue Observation",
    summary:"Keep gathering information without changing the team's posture.",
    base:.08,
    eligible:relevantEncounter,
    terms:ledger=>[
      term("mission_value","mission remains worthwhile",ledger.missionValue,.20),
      term("information_need","more information is useful",ledger.informationNeed,.22),
      term("uncertainty","intent remains uncertain",ledger.informationUncertainty,.14),
      term("position","current position is sustainable",ledger.positionSecurity,.10),
      term("low_detection","detection pressure is limited",ledger.detectionRisk,.08,{invert:true}),
      term("low_time_pressure","time permits patience",ledger.timePressure,.06,{invert:true}),
      term("relevance","contact is worth watching",ledger.encounterRelevance,.08),
      term("detection_penalty","detection may compromise the mission",ledger.detectionRisk,-.12)
    ],
    reason:ledger=>`The mission still benefits from information, the contact's intent remains uncertain, and ${ledger.positionLabel} can support continued observation.`
  }),
  option({
    id:"heighten_watch",
    label:"Heighten Watch",
    summary:"Increase team attention while holding the current position and avoiding escalation.",
    base:.06,
    eligible:relevantEncounter,
    terms:ledger=>[
      term("mission_value","approach security matters",ledger.missionValue,.17),
      term("information_need","the team needs clearer information",ledger.informationNeed,.16),
      term("relevance","the contact is mission-relevant",ledger.encounterRelevance,.22),
      term("uncertainty","unknown intent justifies alertness",ledger.informationUncertainty,.12),
      term("security_orientation","mission favors active security",ledger.securityOrientation,.18),
      term("position","current position can be held",ledger.positionSecurity,.08),
      term("detection_risk","possible detection rewards vigilance",ledger.detectionRisk,.03),
      term("certainty","the report is credible enough to monitor",ledger.informationCertainty,.05),
      term("resource_conservation","watchfulness avoids unnecessary cost",ledger.resourceConservation,.03),
      term("boundary_trigger","the mission boundary now asks for outward clarification",ledger.boundaryTrigger,-.20)
    ],
    reason:ledger=>`The contact is mission-relevant, information remains incomplete, and the team's security responsibility favors a more alert watch without escalating.`
  }),
  option({
    id:"maintain_concealment",
    label:"Maintain Concealment",
    summary:"Preserve the hidden position while retaining awareness and withdrawal options.",
    base:.05,
    eligible:relevantEncounter,
    terms:ledger=>[
      term("concealment","concealment directly supports the mission",ledger.concealmentValue,.25),
      term("detection_risk","discovery would be costly",ledger.detectionRisk,.20),
      term("preservation","team longevity is a high priority",ledger.teamPreservation,.16),
      term("uncertainty","unknown intent favors reversible action",ledger.informationUncertainty,.10),
      term("exit_options","withdrawal options remain available",ledger.exitOptions,.06),
      term("mission_value","concealment preserves mission value",ledger.missionValue,.08),
      term("stealth_orientation","mission favors remaining unseen",ledger.stealthOrientation,.15),
      term("position","current hidden position is useful",ledger.positionSecurity,.04),
      term("warning_heard","a directed warning confirms that remaining in place risks further discovery",ledger.warningHeard,-.24)
    ],
    reason:ledger=>`Preserving concealment and team longevity is the strongest way to continue the mission while the contact's identity and intent remain unknown.`
  }),
  option({
    id:"withdraw_silently",
    label:"Withdraw Silently",
    summary:"End the compromised watch without replying, revealing identity, or escalating the encounter.",
    base:.10,
    eligible:silentWithdrawalEligible,
    terms:ledger=>[
      term("warning_heard","the warning indicates likely detection",ledger.warningHeard,.22),
      term("preservation","withdrawal preserves the team",ledger.teamPreservation,.18),
      term("detection_risk","remaining risks further discovery",ledger.detectionRisk,.17),
      term("exit_options","a viable withdrawal route exists",ledger.exitOptions,.17),
      term("stealth_orientation","silence preserves identity and intent",ledger.stealthOrientation,.13),
      term("mobility","the team is prepared to disengage",ledger.mobilityOrientation,.11),
      term("route_available","the mission has an authored withdrawal route",ledger.withdrawalPlanAvailable,.08),
      term("reversible","withdrawal avoids irreversible escalation",ledger.reversibleCommunicationValue,.06),
      term("mission_cost","leaving forfeits some remaining observation value",ledger.missionValue,-.08)
    ],
    reason:ledger=>`The warning makes continued concealment unreliable; ${ledger.exitLabel} allows the team to disengage without confirming its identity or escalating.`
  }),
  option({
    id:"monitor_departure",
    label:"Monitor Departure",
    summary:"Hold the boundary, observe the group's departure, and avoid unnecessary pursuit or repeated warnings.",
    base:.10,
    eligible:monitorDepartureEligible,
    terms:ledger=>[
      term("departure","the warned group is leaving",ledger.departureEvidence,.30),
      term("warning_issued","the boundary has already been communicated",ledger.warningIssued,.18),
      term("mission_value","the approach still requires observation",ledger.missionValue,.12),
      term("security_orientation","visible control is preserved without pursuit",ledger.securityOrientation,.11),
      term("position","the team can hold a stable observation line",ledger.positionSecurity,.09),
      term("preservation","not pursuing avoids unnecessary risk",ledger.teamPreservation,.08),
      term("resource_conservation","monitoring consumes few resources",ledger.resourceConservation,.06),
      term("no_hostile_evidence","no hostile act requires escalation",ledger.hostileEvidence,.08,{invert:true})
    ],
    reason:ledger=>`The warned group is departing the monitored area; holding position and observing completion satisfies the boundary without pursuit or repeated escalation.`
  }),
  option({
    id:"wait",
    label:"Wait",
    summary:"Hold the decision open until the information changes or the situation becomes clearer.",
    base:.04,
    eligible:relevantEncounter,
    terms:ledger=>[
      term("uncertainty","evidence remains uncertain",ledger.informationUncertainty,.22),
      term("low_time_pressure","the mission can tolerate delay",ledger.timePressure,.18,{invert:true}),
      term("preservation","waiting limits immediate risk",ledger.teamPreservation,.10),
      term("resource_conservation","waiting consumes few resources",ledger.resourceConservation,.08),
      term("exit_options","the team retains options",ledger.exitOptions,.04),
      term("low_relevance","the contact is not yet decisive",ledger.encounterRelevance,.08,{invert:true}),
      term("position","the current position can be maintained",ledger.positionSecurity,.04)
    ],
    reason:ledger=>`The team has time, the evidence is still uncertain, and waiting preserves resources and options without committing to an irreversible response.`
  }),
  option({
    id:"warn",
    label:"Issue Warning",
    summary:"Make the mission boundary explicit and request identification without initiating violence.",
    base:.07,
    eligible:boundaryWarningEligible,
    terms:ledger=>[
      term("boundary_trigger","a credible contact has activated the mission boundary",ledger.boundaryTrigger,.34),
      term("boundary_proximity","the contact is inside the protected area",ledger.boundaryProximity,.16),
      term("security_orientation","mission favors visible control",ledger.securityOrientation,.13),
      term("mission_value","the protected responsibility matters",ledger.missionValue,.10),
      term("relevance","the contact affects the mission",ledger.encounterRelevance,.10),
      term("certainty","the team has enough evidence to address the sector",ledger.informationCertainty,.07),
      term("activity","meaningful activity supports clarification",ledger.activityEvidence,.08),
      term("reversible","communication is more reversible than violence",ledger.reversibleCommunicationValue,.09),
      term("position","the team can speak from a sustainable position",ledger.positionSecurity,.04),
      term("uncertainty_penalty","uncertainty still limits confidence",ledger.informationUncertainty,-.04)
    ],
    reason:ledger=>`A credible armed presence has activated ${ledger.boundaryLabel}; a directed warning can clarify intent and establish the boundary without violence.`
  }),
  option({
    id:"reroute",
    label:"Reroute",
    summary:"Change the mission approach to avoid the uncertain contact.",
    base:.02,
    eligible:relevantEncounter,
    terms:ledger=>[
      term("preservation","avoiding contact protects the team",ledger.teamPreservation,.14),
      term("detection_risk","the current approach risks discovery",ledger.detectionRisk,.16),
      term("mobility","the mission tolerates changing approach",ledger.mobilityOrientation,.14),
      term("exit_options","alternate movement remains possible",ledger.exitOptions,.14),
      term("low_mission_value","the exact position is not essential",ledger.missionValue,.12,{invert:true}),
      term("uncertainty","uncertain intent favors avoidance",ledger.informationUncertainty,.06),
      term("poor_position","the current position is weak",ledger.positionSecurity,.08,{invert:true}),
      term("time_penalty","rerouting costs time",ledger.timePressure,-.08)
    ],
    reason:ledger=>`Avoidance would preserve the team and use ${ledger.exitLabel}, but changing the mission approach carries time and objective costs.`
  }),
  option({
    id:"withdraw",
    label:"Withdraw",
    summary:"End the local encounter and preserve the team for later work.",
    base:.01,
    eligible:relevantEncounter,
    terms:ledger=>[
      term("preservation","team survival matters",ledger.teamPreservation,.18),
      term("detection_risk","continued presence risks discovery",ledger.detectionRisk,.18),
      term("exit_options","a viable withdrawal route exists",ledger.exitOptions,.16),
      term("mobility","the team is prepared to disengage",ledger.mobilityOrientation,.12),
      term("low_mission_value","the mission can be abandoned",ledger.missionValue,.15,{invert:true}),
      term("poor_position","the current position is unsafe",ledger.positionSecurity,.10,{invert:true}),
      term("relevance","the contact is meaningful",ledger.encounterRelevance,.05),
      term("hostile_evidence","hostile behavior would justify leaving",ledger.hostileEvidence,.20),
      term("time_penalty","withdrawal may forfeit time-sensitive value",ledger.timePressure,-.06)
    ],
    reason:ledger=>`Withdrawal preserves future capacity, but current evidence does not yet show enough danger or mission failure to justify abandoning the task.`
  })
]);

export function getResponseOption(id){
  return TEAM_RESPONSE_OPTIONS.find(option=>option.id===id)??null;
}
