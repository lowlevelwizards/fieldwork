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
