const COMMON_REASSESSMENT_TRIGGERS=Object.freeze([
  "contact_lost",
  "encounter_evidence_stale",
  "team_member_incapable",
  "mission_changed",
  "hostile_action_observed"
]);

function role({id,label,responsibility,selectionReason,fulfillment,preference=()=>0}){
  return Object.freeze({id,label,responsibility,selectionReason,fulfillment:Object.freeze({...fulfillment}),preference});
}

function phase(id,label,reason){return Object.freeze({id,label,reason});}

const PROCEDURES=Object.freeze({
  heighten_watch:Object.freeze({
    id:"security_watch",
    label:"Security Watch",
    responseId:"heighten_watch",
    description:"Distribute attention across the monitored approach without escalating or abandoning the current position.",
    establishDuration:.7,
    phases:Object.freeze([
      phase("establish_responsibilities","Establish Responsibilities","The selected response requires distinct observation, security, and reserve responsibilities."),
      phase("maintain_watch","Maintain Watch","Responsibilities are assigned and the team can maintain a broader security picture."),
      phase("reassess","Reassess","New evidence or an invalid assignment requires the team to reconsider the procedure.")
    ]),
    activePhaseId:"maintain_watch",
    permissions:Object.freeze({observe:true,report:true,relocate:true,warn:false,fire:false}),
    reassessmentTriggers:COMMON_REASSESSMENT_TRIGGERS,
    roles:Object.freeze([
      role({
        id:"primary_observer",
        label:"Primary Observer",
        responsibility:"Maintain visual attention on the reported contact sector and report meaningful changes.",
        selectionReason:"Prefer the capable actor who already possesses the authored observation responsibility.",
        fulfillment:{need:"observe_contact",label:"Reported contact sector",maximumRange:1180,fieldOfViewDegrees:72},
        preference:actor=>actor.aiV2Assignment?.action==="observe_sector"?100:0
      }),
      role({
        id:"alternate_security",
        label:"Alternate Security",
        responsibility:"Watch an uncovered approach so the team does not fixate on one uncertain contact.",
        selectionReason:"Prefer a capable security-oriented actor who is not already the primary observer.",
        fulfillment:{need:"observe_alternate_approach",label:"Alternate approach",angularOffsetDegrees:55,distance:520,maximumRange:900,fieldOfViewDegrees:70,positionPolicy:{mayReposition:true,minimumVisibility:.58,minimumCoverage:.66,maximumTravel:190,maximumCohesionDistance:420,minimumFriendlySpacing:68,claimSpacing:76,reassessEvery:1.5,retryAfter:1.1,speedMultiplier:.56,arrivalRadius:10}},
        preference:actor=>String(actor.role??"").toLowerCase().includes("security")?60:String(actor.role??"").toLowerCase().includes("rifle")?25:0
      }),
      role({
        id:"team_reserve",
        label:"Team Reserve",
        responsibility:"Remain available for communication, assistance, or a later response without duplicating an occupied responsibility.",
        selectionReason:"Assign the remaining capable actor after observation and alternate security are covered.",
        fulfillment:{need:"hold_rear_ready",label:"Rear ready sector",distance:340},
        preference:actor=>String(actor.role??"").toLowerCase().includes("engineer")?25:0
      })
    ])
  }),

  warn:Object.freeze({
    id:"challenge_unknown_contact",
    label:"Challenge Unknown Contact",
    responseId:"warn",
    description:"Make the mission boundary explicit while preserving observation and alternate security.",
    establishDuration:.55,
    phases:Object.freeze([
      phase("establish_responsibilities","Establish Responsibilities","The warning response requires one challenger and two operators to preserve security."),
      phase("issue_warning","Issue Warning","The challenger must address the reported sector while observers maintain the team's information picture."),
      phase("await_response","Await Response","The warning has been delivered; the team holds its boundary and watches for compliance, silence, or movement."),
      phase("reassess","Reassess","A failed warning, stale evidence, or a meaningful response requires the team to reconsider its approach.")
    ]),
    activePhaseId:"issue_warning",
    permissions:Object.freeze({observe:true,report:true,relocate:true,warn:true,fire:false}),
    reassessmentTriggers:Object.freeze([
      "warning_delivered",
      "warning_failed",
      "contact_lost",
      "encounter_evidence_stale",
      "team_member_incapable",
      "mission_changed",
      "hostile_action_observed"
    ]),
    roles:Object.freeze([
      role({
        id:"challenger",
        label:"Challenger",
        responsibility:"State the monitored boundary clearly and request that the unknown group stop and identify itself.",
        selectionReason:"Prefer the available engineer or team reserve so the established observers can maintain their sectors.",
        fulfillment:{need:"issue_warning",label:"Reported contact sector"},
        preference:actor=>String(actor.role??"").toLowerCase().includes("engineer")?90:actor.aiV2Assignment?.action==="observe_sector"?-60:15
      }),
      role({
        id:"primary_observer",
        label:"Primary Observer",
        responsibility:"Maintain visual attention on the challenged sector and report meaningful movement or weapon changes.",
        selectionReason:"Prefer the actor who already possesses the authored observation responsibility.",
        fulfillment:{need:"observe_contact",label:"Challenged contact sector",maximumRange:1180,fieldOfViewDegrees:72},
        preference:actor=>actor.aiV2Assignment?.action==="observe_sector"?100:0
      }),
      role({
        id:"alternate_security",
        label:"Alternate Security",
        responsibility:"Preserve coverage of the alternate approach while the challenger addresses the reported group.",
        selectionReason:"Prefer the established alternate-security actor or another capable security-oriented operator.",
        fulfillment:{need:"observe_alternate_approach",label:"Alternate approach",angularOffsetDegrees:55,distance:520,maximumRange:900,fieldOfViewDegrees:70,positionPolicy:{mayReposition:true,minimumVisibility:.58,minimumCoverage:.66,maximumTravel:190,maximumCohesionDistance:420,minimumFriendlySpacing:68,claimSpacing:76,reassessEvery:1.5,retryAfter:1.1,speedMultiplier:.56,arrivalRadius:10}},
        preference:actor=>String(actor.role??"").toLowerCase().includes("rifle")?70:String(actor.role??"").toLowerCase().includes("security")?45:0
      })
    ])
  }),
  monitor_departure:Object.freeze({
    id:"monitor_departure",
    label:"Monitor Departure",
    responseId:"monitor_departure",
    description:"Hold the established boundary while confirming that the warned group continues to leave without pursuit or renewed escalation.",
    establishDuration:.45,
    phases:Object.freeze([
      phase("establish_responsibilities","Establish Responsibilities","The de-escalation response preserves contact observation, alternate security, and a ready reserve."),
      phase("observe_departure","Observe Departure","The warned group is leaving; the team holds its line and watches the departure without pursuing."),
      phase("boundary_restored","Boundary Restored","The group departed without violence; the team returns to a stable security posture without pursuit."),
      phase("reassess","Reassess","A reversal, renewed approach, or hostile act would require a new response.")
    ]),
    activePhaseId:"observe_departure",
    permissions:Object.freeze({observe:true,report:true,relocate:false,warn:false,fire:false}),
    reassessmentTriggers:Object.freeze([
      "departure_reversed",
      "contact_lost",
      "encounter_evidence_stale",
      "team_member_incapable",
      "mission_changed",
      "hostile_action_observed"
    ]),
    roles:Object.freeze([
      role({
        id:"departure_observer",
        label:"Departure Observer",
        responsibility:"Maintain visual attention on the departing group and report any reversal or renewed approach.",
        selectionReason:"Prefer the actor already carrying the primary observation responsibility.",
        fulfillment:{need:"observe_contact",label:"Departing contact sector",maximumRange:1000,fieldOfViewDegrees:78},
        preference:actor=>actor.aiV2Assignment?.action==="observe_sector"?100:0
      }),
      role({
        id:"alternate_security",
        label:"Alternate Security",
        responsibility:"Preserve coverage of the alternate approach while the primary observer confirms departure.",
        selectionReason:"Prefer a capable rifle or security operator who is not the departure observer.",
        fulfillment:{need:"observe_alternate_approach",label:"Alternate approach",angularOffsetDegrees:55,distance:520,maximumRange:900,fieldOfViewDegrees:70},
        preference:actor=>String(actor.role??"").toLowerCase().includes("rifle")?70:String(actor.role??"").toLowerCase().includes("security")?45:0
      }),
      role({
        id:"team_reserve",
        label:"Team Reserve",
        responsibility:"Remain available while the team confirms that the encounter is ending without violence.",
        selectionReason:"Assign the remaining capable actor after both observation responsibilities are covered.",
        fulfillment:{need:"hold_rear_ready",label:"Rear ready sector",distance:300},
        preference:actor=>String(actor.role??"").toLowerCase().includes("engineer")?35:0
      })
    ])
  }),
  withdraw_silently:Object.freeze({
    id:"break_contact_quietly",
    label:"Break Contact Quietly",
    responseId:"withdraw_silently",
    description:"Disengage in stages along the authored withdrawal route without replying, pursuing, or exposing every team member at once.",
    establishDuration:.55,
    phases:Object.freeze([
      phase("establish_responsibilities","Establish Responsibilities","The withdrawal response requires a lead mover, a protected mover, and a rear watch."),
      phase("lead_withdrawal","Lead Withdrawal","The withdrawal lead moves first to establish the route while the others remain covered."),
      phase("protected_movement","Protected Movement","The protected mover follows while the rear watch preserves contact awareness."),
      phase("rear_disengage","Rear Disengage","The rear watch leaves last after the other operators reach the withdrawal route."),
      phase("withdrawal_complete","Withdrawal Complete","All assigned operators reached the withdrawal route without replying or escalating."),
      phase("reassess","Reassess","A blocked route, incapable mover, or hostile action requires the team to reconsider the withdrawal.")
    ]),
    activePhaseId:"lead_withdrawal",
    permissions:Object.freeze({observe:true,report:true,relocate:true,warn:false,fire:false}),
    reassessmentTriggers:Object.freeze([
      "withdrawal_stage_completed",
      "withdrawal_move_failed",
      "route_blocked",
      "team_member_incapable",
      "hostile_action_observed",
      "mission_changed"
    ]),
    roles:Object.freeze([
      role({
        id:"withdrawal_lead",
        label:"Withdrawal Lead",
        responsibility:"Move first to the authored withdrawal route and establish the team's next safe position.",
        selectionReason:"Prefer the scout who can lead movement without requiring the medical reserve to expose first.",
        fulfillment:{need:"staged_withdrawal",stageId:"lead_withdrawal",routeRole:"withdrawal_lead",waitingLabel:"Holding route lead"},
        preference:actor=>String(actor.role??"").toLowerCase().includes("scout")?95:0
      }),
      role({
        id:"protected_mover",
        label:"Protected Mover",
        responsibility:"Follow the withdrawal lead after the route is established while remaining protected by the rear watch.",
        selectionReason:"Prefer the field medic or support operator so the team preserves medically useful capacity.",
        fulfillment:{need:"staged_withdrawal",stageId:"protected_movement",routeRole:"protected_mover",waitingLabel:"Awaiting protected movement"},
        preference:actor=>String(actor.role??"").toLowerCase().includes("medic")?90:10
      }),
      role({
        id:"rear_watch",
        label:"Rear Watch",
        responsibility:"Maintain awareness of the warned group until the other operators withdraw, then leave last.",
        selectionReason:"Prefer the rifle or security operator who can preserve contact awareness during staged movement.",
        fulfillment:{need:"rear_watch_then_withdraw",stageId:"rear_disengage",routeRole:"rear_watch",label:"Warned contact sector",maximumRange:1280,fieldOfViewDegrees:78},
        preference:actor=>{
          const roleName=String(actor.role??"").toLowerCase();
          if(roleName.includes("rifle")||roleName.includes("security"))return 90;
          if(roleName.includes("medic"))return -40;
          return 0;
        }
      })
    ])
  }),
  maintain_concealment:Object.freeze({
    id:"concealed_observation",
    label:"Concealed Observation",
    responseId:"maintain_concealment",
    description:"Preserve the hidden position while maintaining contact awareness and a viable withdrawal option.",
    establishDuration:.7,
    phases:Object.freeze([
      phase("establish_responsibilities","Establish Responsibilities","The selected response requires observation, local security, and withdrawal responsibilities."),
      phase("maintain_contact","Maintain Contact","Responsibilities are assigned and the team can preserve concealment while monitoring the encounter."),
      phase("reassess","Reassess","Detection, stale evidence, or an invalid assignment requires the team to reconsider the procedure.")
    ]),
    activePhaseId:"maintain_contact",
    permissions:Object.freeze({observe:true,report:true,relocate:true,warn:false,fire:false}),
    reassessmentTriggers:Object.freeze([
      "contact_lost",
      "encounter_evidence_stale",
      "team_detected",
      "team_member_incapable",
      "mission_changed",
      "hostile_action_observed"
    ]),
    roles:Object.freeze([
      role({
        id:"concealed_observer",
        label:"Concealed Observer",
        responsibility:"Maintain contact awareness without exposing the team and report meaningful changes.",
        selectionReason:"Prefer the capable actor who already possesses the authored concealed observation responsibility.",
        fulfillment:{need:"observe_contact",label:"Reported contact sector",maximumRange:1180,fieldOfViewDegrees:72},
        preference:actor=>actor.aiV2Assignment?.action==="observe_sector"?100:0
      }),
      role({
        id:"local_security",
        label:"Local Security",
        responsibility:"Watch for discovery or movement toward the concealed position from an alternate approach.",
        selectionReason:"Prefer a capable rifle or security actor rather than the medical reserve.",
        fulfillment:{need:"observe_alternate_approach",label:"Flank approach",angularOffsetDegrees:55,distance:520,maximumRange:900,fieldOfViewDegrees:70,positionPolicy:{mayReposition:true,minimumVisibility:.58,minimumCoverage:.66,maximumTravel:190,maximumCohesionDistance:420,minimumFriendlySpacing:68,claimSpacing:76,reassessEvery:1.5,retryAfter:1.1,speedMultiplier:.54,arrivalRadius:10}},
        preference:actor=>{
          const roleName=String(actor.role??"").toLowerCase();
          if(roleName.includes("rifle")||roleName.includes("security"))return 65;
          if(roleName.includes("medic"))return -30;
          return 0;
        }
      }),
      role({
        id:"withdrawal_reserve",
        label:"Withdrawal Reserve",
        responsibility:"Preserve the rear option and remain available to assist a casualty, carry supplies, or support withdrawal.",
        selectionReason:"Prefer the remaining medically useful or support-oriented actor after observation and local security are covered.",
        fulfillment:{need:"hold_rear_ready",label:"Withdrawal route",distance:340},
        preference:actor=>String(actor.role??"").toLowerCase().includes("medic")?55:0
      })
    ])
  })
});

export function getProcedureDefinitionForResponse(responseId){return PROCEDURES[responseId]??null;}
export function getProcedurePhase(definition,phaseId){return definition?.phases?.find(item=>item.id===phaseId)??null;}
export const TEAM_PROCEDURE_DEFINITIONS=PROCEDURES;
