function role({id,label,responsibility,selectionReason,fulfillment,preference=()=>0,eligible=()=>true}){
  return Object.freeze({id,label,responsibility,selectionReason,fulfillment:Object.freeze({...fulfillment}),preference,eligible});
}
function phase(id,label,reason){return Object.freeze({id,label,reason});}
function transition(event,{from,to,reason,complete=false,guard=null,apply=null}){return Object.freeze({event,from,to,reason,complete,guard,apply});}
function capability(actor,key,fallback=0){const value=Number(actor?.aiV2Capabilities?.[key]);return Number.isFinite(value)?value:fallback;}

const ESTABLISH_FORWARD_POSITION=Object.freeze({
  id:"establish_forward_position",
  label:"Establish Forward Position",
  responseId:"establish_forward_position",
  description:"Carry the planned field package through the campaign network, secure a connected site, establish a persistent forward position, and verify it for later operations.",
  establishDuration:.45,
  activePhaseId:"approach_objective",
  phases:Object.freeze([
    phase("establish_responsibilities","Establish Responsibilities","The team assigns supply, construction, and security ownership."),
    phase("approach_objective","Approach Forward Site","Operators establish separate positions around the proposed forward site."),
    phase("inspect_objective","Inspect Field Site","The builder verifies that the connected site can support a field position."),
    phase("perform_objective_work","Establish Position","The builder and supply lead establish the persistent position while security protects the work."),
    phase("objective_operational","Position Operational","The new position is connected, usable, and ready to support later operations.")
  ]),
  permissions:Object.freeze({relocate:true,inspect:true,work:true,assist:true,observe:true,carry:true,fire:false,pursue:false}),
  reassessmentTriggers:Object.freeze(["hostile_action_observed","friendly_casualty_reported","team_member_incapable","mission_changed","objective_state_changed","resource_shortage","route_state_changed"]),
  roles:Object.freeze([
    role({id:"approach_lead",label:"Supply Lead",responsibility:"Preserve the deployment route and organize the field package at the site.",selectionReason:"Prefer carrying and navigation capability.",fulfillment:{need:"forward_position_role"},preference:actor=>capability(actor,"carrying")*95+capability(actor,"navigation")*55}),
    role({id:"objective_specialist",label:"Field Builder",responsibility:"Inspect and establish the persistent field position.",selectionReason:"Prefer technical work capability.",fulfillment:{need:"forward_position_role"},preference:actor=>capability(actor,"technicalWork")*130,eligible:actor=>capability(actor,"technicalWork")>.05}),
    role({id:"local_security",label:"Site Security",responsibility:"Secure the construction perimeter and preserve a return route.",selectionReason:"Prefer security and observation capability.",fulfillment:{need:"forward_position_role"},preference:actor=>capability(actor,"security")*100+capability(actor,"observation")*42})
  ]),
  transitions:Object.freeze([
    transition("objective_position_reached",{
      from:"approach_objective",
      to:record=>(record.objective?.arrivedRoles?.length??0)>=3?"inspect_objective":"approach_objective",
      reason:"All field-position responsibilities occupy distinct sites before construction begins.",
      apply:(record,{data})=>{record.objective=record.objective??{arrivedRoles:[]};record.objective.arrivedRoles=record.objective.arrivedRoles??[];if(data?.roleId&&!record.objective.arrivedRoles.includes(data.roleId))record.objective.arrivedRoles.push(data.roleId);record.objective.objectiveId=data?.objectiveId??record.objective.objectiveId??null;}
    }),
    transition("objective_inspected",{from:"inspect_objective",to:"perform_objective_work",reason:"The site is connected and buildable.",apply:(record,{data})=>{record.objective={...(record.objective??{}),objectiveId:data?.objectiveId??null,inspected:true};}}),
    transition("objective_restored",{from:"perform_objective_work",to:"objective_operational",reason:"Finite construction work established the persistent position.",complete:true,apply:(record,{data})=>{record.objective={...(record.objective??{}),restored:true,state:data?.state??"operational"};}})
  ])
});

export const AI_V2_2_3_PROCEDURES=Object.freeze({
  establish_forward_position:ESTABLISH_FORWARD_POSITION
});
