function role({id,label,responsibility,selectionReason,fulfillment,preference=()=>0,eligible=()=>true}){
  return Object.freeze({id,label,responsibility,selectionReason,fulfillment:Object.freeze({...fulfillment}),preference,eligible});
}
function phase(id,label,reason){return Object.freeze({id,label,reason});}
function transition(event,{from,to,reason,complete=false,guard=null,apply=null}){return Object.freeze({event,from,to,reason,complete,guard,apply});}
function capability(actor,key,fallback=0){const value=Number(actor?.aiV2Capabilities?.[key]);return Number.isFinite(value)?value:fallback;}

function approachTransition(nextPhase){
  return transition("objective_position_reached",{
    from:"approach_objective",
    to:record=>Boolean(record.objective?.arrivedRoles?.includes("objective_specialist")&&record.objective?.arrivedRoles?.some(roleId=>roleId!=="objective_specialist"))?nextPhase:"approach_objective",
    reason:"The specialist has access and at least one teammate has established useful local coverage; the remaining role may adapt instead of completing a fixed formation.",
    apply:(record,{data})=>{
      record.objective=record.objective??{arrivedRoles:[]};
      record.objective.arrivedRoles=record.objective.arrivedRoles??[];
      if(data?.roleId&&!record.objective.arrivedRoles.includes(data.roleId))record.objective.arrivedRoles.push(data.roleId);
      record.objective.objectiveId=data?.objectiveId??record.objective.objectiveId??null;
    }
  });
}

const SERVICE_INFRASTRUCTURE=Object.freeze({
  id:"service_infrastructure",
  label:"Adaptive Infrastructure Service",
  responseId:"service_infrastructure",
  description:"Approach, diagnose, service, verify, and secure infrastructure while preserving resumable physical progress and replaceable responsibilities.",
  establishDuration:.45,
  activePhaseId:"approach_objective",
  phases:Object.freeze([
    phase("establish_responsibilities","Establish Responsibilities","The team assigns route, technical, and security ownership."),
    phase("approach_objective","Approach Worksite","Operators establish separate positions around the infrastructure."),
    phase("inspect_objective","Diagnose Failure","The technician diagnoses the current state and required work."),
    phase("perform_objective_work","Service Infrastructure","The technician performs finite capability-scaled work while teammates secure and assist."),
    phase("objective_operational","Verify & Hold","The infrastructure is functional and the team verifies the site before return.")
  ]),
  permissions:Object.freeze({relocate:true,inspect:true,work:true,assist:true,observe:true,carry:false,fire:false,pursue:false}),
  reassessmentTriggers:Object.freeze(["hostile_action_observed","friendly_casualty_reported","team_member_incapable","mission_changed","objective_state_changed","resource_shortage"]),
  roles:Object.freeze([
    role({id:"approach_lead",label:"Route Lead",responsibility:"Establish a usable approach and preserve the return route.",selectionReason:"Prefer navigation and scouting capability.",fulfillment:{need:"objective_mission_role"},preference:actor=>capability(actor,"navigation")*100+capability(actor,"scouting")*40}),
    role({id:"objective_specialist",label:"Field Technician",responsibility:"Diagnose and complete the required technical work.",selectionReason:"Prefer the strongest available technical specialist.",fulfillment:{need:"objective_mission_role"},preference:actor=>capability(actor,"technicalWork")*130,eligible:actor=>capability(actor,"technicalWork")>.05}),
    role({id:"local_security",label:"Local Security",responsibility:"Occupy a distinct security position and protect uninterrupted field work.",selectionReason:"Prefer security and observation capability.",fulfillment:{need:"objective_mission_role"},preference:actor=>capability(actor,"security")*100+capability(actor,"observation")*42})
  ]),
  transitions:Object.freeze([
    approachTransition("inspect_objective"),
    transition("objective_inspected",{from:"inspect_objective",to:"perform_objective_work",reason:"Diagnosis established the work plan and preserved existing progress.",apply:(record,{data})=>{record.objective={...(record.objective??{}),objectiveId:data?.objectiveId??null,inspected:true};}}),
    transition("objective_restored",{from:"perform_objective_work",to:"objective_operational",reason:"Finite service work reached the desired state.",complete:true,apply:(record,{data})=>{record.objective={...(record.objective??{}),restored:true,state:data?.state??"operational"};}})
  ])
});

const RECOVER_SUPPLIES=Object.freeze({
  id:"recover_supplies",
  label:"Physical Supply Recovery",
  responseId:"recover_supplies",
  description:"Inspect a cache, allocate finite packages, physically secure cargo, and return only what the team actually carries out.",
  establishDuration:.45,
  activePhaseId:"approach_objective",
  phases:Object.freeze([
    phase("establish_responsibilities","Establish Responsibilities","The team assigns route, handling, and security ownership."),
    phase("approach_objective","Approach Cache","Operators establish a separated cache perimeter."),
    phase("inspect_objective","Inspect Cache","The handler verifies the finite packages available for recovery."),
    phase("collect_supplies","Collect Cargo","The handler and available assistants physically collect finite packages."),
    phase("cargo_secured","Cargo Secured","The team holds a return-ready posture around the cargo it actually secured.")
  ]),
  permissions:Object.freeze({relocate:true,inspect:true,work:false,assist:true,observe:true,carry:true,fire:false,pursue:false}),
  reassessmentTriggers:Object.freeze(["hostile_action_observed","friendly_casualty_reported","team_member_incapable","cargo_dropped","mission_changed","objective_state_changed"]),
  roles:Object.freeze([
    role({id:"approach_lead",label:"Route Lead",responsibility:"Establish the cache approach and preserve the return lane.",selectionReason:"Prefer navigation and scouting capability.",fulfillment:{need:"objective_mission_role"},preference:actor=>capability(actor,"navigation")*100+capability(actor,"scouting")*42}),
    role({id:"objective_specialist",label:"Supply Handler",responsibility:"Inspect, allocate, and secure finite cargo packages.",selectionReason:"Prefer the strongest carrying capability.",fulfillment:{need:"objective_mission_role"},preference:actor=>capability(actor,"carrying")*130,eligible:actor=>capability(actor,"carrying")>.05}),
    role({id:"local_security",label:"Local Security",responsibility:"Secure the cache perimeter and remain available to recover dropped cargo.",selectionReason:"Prefer security and observation capability.",fulfillment:{need:"objective_mission_role"},preference:actor=>capability(actor,"security")*100+capability(actor,"observation")*40})
  ]),
  transitions:Object.freeze([
    approachTransition("inspect_objective"),
    transition("objective_inspected",{from:"inspect_objective",to:"collect_supplies",reason:"The finite cache contents are known and can be allocated.",apply:(record,{data})=>{record.objective={...(record.objective??{}),objectiveId:data?.objectiveId??null,inspected:true};}}),
    transition("cargo_secured",{from:"collect_supplies",to:"cargo_secured",reason:"All recoverable packages are carried, intentionally left, or no longer available.",complete:true,apply:(record,{data})=>{record.cargo={securedUnits:data?.securedUnits??0,leftUnits:data?.leftUnits??0};}})
  ])
});

const SURVEY_ROUTE=Object.freeze({
  id:"survey_route",
  label:"Moving Route Survey",
  responseId:"survey_route",
  description:"Move through a seeded chain of observation points, record partial intelligence, and return with whatever coverage the team completed.",
  establishDuration:.45,
  activePhaseId:"approach_survey_point",
  phases:Object.freeze([
    phase("establish_responsibilities","Establish Responsibilities","The team assigns scout, recorder, and rear-security ownership."),
    phase("approach_survey_point","Advance to Survey Point","The patrol moves as a responsibility group to the next route observation point."),
    phase("record_survey_point","Observe & Record","The scout and recorder establish current route intelligence while rear security watches the previous leg."),
    phase("survey_complete","Survey Complete","Enough route coverage is recorded for a useful return.")
  ]),
  permissions:Object.freeze({relocate:true,inspect:true,work:false,assist:true,observe:true,carry:false,fire:false,pursue:false}),
  reassessmentTriggers:Object.freeze(["hostile_action_observed","friendly_casualty_reported","team_member_incapable","survey_point_unreachable","mission_changed"]),
  roles:Object.freeze([
    role({id:"approach_lead",label:"Route Scout",responsibility:"Lead the patrol to each observation point and test the route ahead.",selectionReason:"Prefer scouting and navigation capability.",fulfillment:{need:"survey_route_role"},preference:actor=>capability(actor,"scouting")*110+capability(actor,"navigation")*55}),
    role({id:"objective_specialist",label:"Field Recorder",responsibility:"Observe, record, and preserve route intelligence at each reached point.",selectionReason:"Prefer observation capability.",fulfillment:{need:"survey_route_role"},preference:actor=>capability(actor,"observation")*125+capability(actor,"scouting")*25}),
    role({id:"local_security",label:"Rear Security",responsibility:"Preserve awareness of the previous route leg and keep the moving patrol coherent.",selectionReason:"Prefer security and observation capability.",fulfillment:{need:"survey_route_role"},preference:actor=>capability(actor,"security")*100+capability(actor,"observation")*42})
  ]),
  transitions:Object.freeze([
    transition("survey_position_reached",{
      from:"approach_survey_point",
      to:record=>(record.survey?.arrivedRoles?.length??0)>=3?"record_survey_point":"approach_survey_point",
      reason:"All patrol responsibilities reached the current survey point.",
      apply:(record,{data})=>{
        record.survey=record.survey??{pointIndex:data?.pointIndex??0,arrivedRoles:[]};
        if(record.survey.pointIndex!==data?.pointIndex){record.survey.pointIndex=data?.pointIndex??0;record.survey.arrivedRoles=[];}
        if(data?.roleId&&!record.survey.arrivedRoles.includes(data.roleId))record.survey.arrivedRoles.push(data.roleId);
      }
    }),
    transition("survey_point_recorded",{
      from:"record_survey_point",
      to:(record,{data})=>data?.complete?"survey_complete":"approach_survey_point",
      reason:"The current point is recorded; continue to the next point or return with completed coverage.",
      complete:false,
      apply:(record,{data})=>{record.survey={pointIndex:data?.nextPointIndex??0,arrivedRoles:[],completedPoints:data?.completedPoints??0,totalPoints:data?.totalPoints??0};if(data?.complete)record.completedAt=data?.now??record.completedAt;}
    })
  ])
});

export const AI_V2_2_2_PROCEDURES=Object.freeze({
  service_infrastructure:SERVICE_INFRASTRUCTURE,
  recover_supplies:RECOVER_SUPPLIES,
  survey_route:SURVEY_ROUTE
});
