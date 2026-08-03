function role({id,label,responsibility,selectionReason,fulfillment,preference=()=>0,eligible=()=>true}){
  return Object.freeze({id,label,responsibility,selectionReason,fulfillment:Object.freeze({...fulfillment}),preference,eligible});
}
function phase(id,label,reason){return Object.freeze({id,label,reason});}
function transition(event,{from,to,reason,complete=false,guard=null,apply=null}){return Object.freeze({event,from,to,reason,complete,guard,apply});}
function capability(actor,key,fallback=0){const value=Number(actor?.aiV2Capabilities?.[key]);return Number.isFinite(value)?value:fallback;}

const RESTORE_OBJECTIVE=Object.freeze({
  id:"restore_field_relay",
  label:"Approach & Restore Field Relay",
  responseId:"restore_objective",
  description:"Turn an unresolved field objective into distinct approach, technical-work, and local-security responsibilities without requiring an encounter stimulus.",
  establishDuration:.55,
  activePhaseId:"approach_objective",
  phases:Object.freeze([
    phase("establish_responsibilities","Establish Responsibilities","The team converts the unresolved objective into distinct approach, work, and security responsibilities."),
    phase("approach_objective","Approach Objective","The team selects a usable approach and moves to separate positions around the worksite."),
    phase("inspect_objective","Inspect Objective","The technical specialist physically inspects the field relay before work begins."),
    phase("perform_objective_work","Restore Objective","The specialist performs finite work while the other operators preserve local security."),
    phase("objective_operational","Objective Operational","The field relay is operational and the team maintains a coherent worksite posture.")
  ]),
  permissions:Object.freeze({relocate:true,inspect:true,work:true,observe:true,fire:false,pursue:false}),
  reassessmentTriggers:Object.freeze(["hostile_action_observed","friendly_casualty_reported","team_member_incapable","mission_changed","objective_state_changed"]),
  roles:Object.freeze([
    role({
      id:"approach_lead",label:"Approach Lead",
      responsibility:"Choose and occupy the lead staging position that establishes a usable approach for the rest of the team.",
      selectionReason:"Prefer the capable operator with the strongest navigation or scouting capability.",
      fulfillment:{need:"objective_mission_role"},
      preference:actor=>capability(actor,"navigation",0)*100+capability(actor,"scouting",0)*35
    }),
    role({
      id:"objective_specialist",label:"Objective Specialist",
      responsibility:"Reach the interaction point, inspect the relay, and complete the required technical work.",
      selectionReason:"Prefer the capable operator with the strongest technical-work capability.",
      fulfillment:{need:"objective_mission_role"},
      preference:actor=>capability(actor,"technicalWork",0)*120,
      eligible:actor=>capability(actor,"technicalWork",0)>.05
    }),
    role({
      id:"local_security",label:"Local Security",
      responsibility:"Occupy a separate worksite position and preserve awareness while the objective specialist works.",
      selectionReason:"Prefer the remaining operator with the strongest security or observation capability.",
      fulfillment:{need:"objective_mission_role"},
      preference:actor=>capability(actor,"security",0)*100+capability(actor,"observation",0)*35
    })
  ]),
  transitions:Object.freeze([
    transition("objective_position_reached",{
      from:"approach_objective",
      to:record=>(record.objective?.arrivedRoles?.length??0)>=3?"inspect_objective":"approach_objective",
      reason:"The team records each distinct objective position and begins inspection only after all three responsibilities are physically established.",
      apply:(record,{data})=>{
        record.objective=record.objective??{arrivedRoles:[]};
        record.objective.arrivedRoles=record.objective.arrivedRoles??[];
        if(data?.roleId&&!record.objective.arrivedRoles.includes(data.roleId))record.objective.arrivedRoles.push(data.roleId);
        record.objective.objectiveId=data?.objectiveId??record.objective.objectiveId??null;
      }
    }),
    transition("objective_inspected",{
      from:"inspect_objective",to:"perform_objective_work",
      reason:"Physical inspection established that the relay is repairable and authorized finite restoration work.",
      apply:(record,{data})=>{record.objective={...(record.objective??{}),objectiveId:data?.objectiveId??record.objective?.objectiveId??null,inspected:true};}
    }),
    transition("objective_restored",{
      from:"perform_objective_work",to:"objective_operational",
      reason:"The relay reached its desired operational state; the team now holds the completed worksite.",
      complete:true,
      apply:(record,{data})=>{record.objective={...(record.objective??{}),objectiveId:data?.objectiveId??record.objective?.objectiveId??null,restored:true,state:data?.state??"operational"};}
    })
  ])
});

export const AI_V2_2_0R_PROCEDURES=Object.freeze({restore_objective:RESTORE_OBJECTIVE});
