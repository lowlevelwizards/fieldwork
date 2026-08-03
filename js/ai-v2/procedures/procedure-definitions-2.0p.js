function role({id,label,responsibility,selectionReason,fulfillment,preference=()=>0,eligible=()=>true}){
  return Object.freeze({id,label,responsibility,selectionReason,fulfillment:Object.freeze({...fulfillment}),preference,eligible});
}
function phase(id,label,reason){return Object.freeze({id,label,reason});}
function transition(event,{from,to,reason,complete=false,guard=null}){
  return Object.freeze({event,from,to,reason,complete,guard});
}

const PROTECTIVE_BREAKAWAY=Object.freeze({
  id:"protective_breakaway",
  label:"Protective Breakaway",
  responseId:"break_contact_under_fire",
  description:"Use one bounded covering responsibility and two staged movers to leave an exposed lane without turning the encounter into an unlimited firefight.",
  establishDuration:.45,
  phases:Object.freeze([
    phase("establish_responsibilities","Establish Responsibilities","Incoming fire requires one covering operator, one lead mover, and one protected mover."),
    phase("lead_movement","Lead Movement","The lead mover leaves the exposed line while the covering operator holds the threat area."),
    phase("protected_movement","Protected Movement","The protected mover follows after the lead reaches the safety route."),
    phase("covering_disengagement","Covering Disengagement","The covering operator stops firing and leaves last after both movers are clear."),
    phase("contact_broken","Contact Broken","All capable operators reached the break-contact route and the bounded combat response has ended."),
    phase("reassess","Reassess","A blocked route, incapable mover, or unusable fire lane requires a new team decision.")
  ]),
  activePhaseId:"lead_movement",
  transitions:Object.freeze([
    transition("withdrawal_stage_completed",{
      from:"lead_movement",
      to:"protected_movement",
      reason:"The lead mover reached the safety route; the protected mover can now follow.",
      guard:data=>data.roleId==="lead_mover"
    }),
    transition("withdrawal_stage_completed",{
      from:"protected_movement",
      to:"covering_disengagement",
      reason:"Both movers are clear; the covering operator must stop firing and disengage last.",
      guard:data=>data.roleId==="protected_mover"
    }),
    transition("withdrawal_stage_completed",{
      from:"covering_disengagement",
      to:"contact_broken",
      reason:"The covering operator reached the safety route and the team has broken contact.",
      complete:true,
      guard:data=>data.roleId==="covering_operator"
    }),
    transition("withdrawal_move_failed",{
      from:"*",
      to:"reassess",
      reason:"A breakaway movement failed and the team must reconsider its route or assignments."
    })
  ]),
  permissions:Object.freeze({observe:true,report:true,relocate:true,warn:false,fire:true}),
  reassessmentTriggers:Object.freeze([
    "withdrawal_stage_completed",
    "withdrawal_move_failed",
    "route_blocked",
    "team_member_incapable",
    "hostile_pressure_ended",
    "mission_changed"
  ]),
  roles:Object.freeze([
    role({
      id:"lead_mover",
      label:"Lead Mover",
      responsibility:"Move first to the authored break-contact route while the covering operator controls the threat direction.",
      selectionReason:"Prefer the scout or strongest movement-oriented operator for the first exposed displacement.",
      fulfillment:{need:"staged_withdrawal",stageId:"lead_movement",routeRole:"withdrawal_lead",waitingLabel:"Awaiting lead movement"},
      preference:actor=>String(actor.role??"").toLowerCase().includes("scout")?100:20
    }),
    role({
      id:"protected_mover",
      label:"Protected Mover",
      responsibility:"Follow the lead mover after the route is established while preserving medically useful or support capacity.",
      selectionReason:"Prefer the field medic or support operator rather than assigning them to the covering weapon.",
      fulfillment:{need:"staged_withdrawal",stageId:"protected_movement",routeRole:"protected_mover",waitingLabel:"Awaiting protected movement"},
      preference:actor=>String(actor.role??"").toLowerCase().includes("medic")?95:15
    }),
    role({
      id:"covering_operator",
      label:"Covering Operator",
      responsibility:"Provide one bounded protective burst toward the evidence-grounded threat area, then stop firing and disengage last.",
      selectionReason:"Prefer the rifle or security operator after both movement responsibilities are covered.",
      fulfillment:{need:"protective_fire_then_withdraw",stageId:"covering_disengagement",routeRole:"rear_watch",maximumRounds:4,fireInterval:.26},
      preference:actor=>{
        const roleName=String(actor.role??"").toLowerCase();
        return roleName.includes("rifle")?110:roleName.includes("security")?80:0;
      }
    })
  ])
});

export const AI_V2_2_0P_PROCEDURES=Object.freeze({
  break_contact_under_fire:PROTECTIVE_BREAKAWAY
});
