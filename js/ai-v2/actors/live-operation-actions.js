const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));
const LIVE_PROCEDURES=new Set(["service_infrastructure","recover_supplies","survey_route"]);

function roleOffset(roleId,point,index=0){
  const angle=(index%2?1:-1)*.12;
  if(roleId==="approach_lead")return{x:Math.sin(angle)*50,y:-70};
  if(roleId==="objective_specialist")return{x:62,y:35};
  return{x:-62,y:35};
}

function supportingContact({actor,teamAgenda,teamKnowledge}){
  const supporting=teamAgenda?.get?.(actor.teamId)?.supporting??null;
  if(!supporting?.subjectId)return null;
  const report=teamKnowledge?.getTeamContacts?.(actor.teamId)?.find(item=>item.subjectId===supporting.subjectId)??null;
  return report?{...report,label:supporting.selected?.label??"Heightened watch"}:null;
}

export function extendLiveOperationContext(baseContext,{game,actor,role,procedure,mission,objectives,objectiveApproaches,teamKnowledge,teamAgenda,now=0}={}){
  if(!mission?.liveOperation||!LIVE_PROCEDURES.has(procedure?.procedureId))return baseContext;
  const operation=game?.livingSandbox?.getOperation?.(mission.operationId??actor.operationId)??null;
  const objectiveId=mission.objectivePlan?.objectiveId??operation?.objectiveId??null;
  const objective=objectiveId?objectives?.get?.(objectiveId):null;
  if(!operation||!objective)return{...baseContext,liveOperation:null};
  const contact=supportingContact({actor,teamAgenda,teamKnowledge});
  const operationId=operation.id;
  const phaseId=procedure.phase?.id??null;
  let destination=null,focus={x:objective.x,y:objective.y},survey=null,cargo=null,approach=null;

  if(procedure.procedureId==="survey_route"){
    survey=game.livingSandbox.surveyStatus(operationId);
    const point=survey.next??survey.points.at(-1)??{id:`${operationId}_fallback`,label:"survey objective",x:objective.x,y:objective.y,index:0};
    const offset=roleOffset(role.roleId,point,point.index??0);
    destination={x:point.x+offset.x,y:point.y+offset.y};
    focus=role.roleId==="local_security"&&survey.completed>0
      ?{x:survey.points[Math.max(0,survey.completed-1)].x,y:survey.points[Math.max(0,survey.completed-1)].y}
      :{x:point.x,y:point.y};
    survey={...survey,currentPoint:{...point}};
  }else{
    const teamActors=(game?.actors??[]).filter(candidate=>candidate.teamId===actor.teamId&&!candidate.medical?.dead);
    approach=objectiveApproaches?.getOrSelect?.({game,teamId:actor.teamId,objective,teamActors,plan:mission.objectivePlan?.approachPolicy??{},now})??null;
    destination=approach?.rolePoints?.[role.roleId]??null;
    const forward=approach?{x:-approach.vector.x,y:-approach.vector.y}:{x:0,y:-1};
    focus={x:objective.x+forward.x*(mission.objectivePlan?.securityFocusDistance??320),y:objective.y+forward.y*(mission.objectivePlan?.securityFocusDistance??320)};
    if(contact&&role.roleId==="local_security")focus={...contact.approximatePosition};
  }

  if(procedure.procedureId==="recover_supplies"){
    const status=game.livingSandbox.cargoStatus(operationId);
    const carrying=(actor.aiV2Cargo??[]).reduce((sum,item)=>sum+(item.units??1),0);
    const capacity=1+Math.floor((Number(actor.aiV2Capabilities?.carrying)||0)*2.2);
    const owned=status.items.find(item=>["at_site","dropped"].includes(item.status)&&item.claimedByActorId===actor.id)??null;
    const availableItems=status.items
      .filter(item=>["at_site","dropped"].includes(item.status)&&(!item.claimedByActorId||item.claimedByActorId===actor.id))
      .sort((a,b)=>distance(actor,a)-distance(actor,b)||String(a.id).localeCompare(String(b.id)));
    const roleSlot=role.roleId==="approach_lead"?0:role.roleId==="objective_specialist"?1:2;
    const available=owned??(availableItems.length?availableItems[roleSlot%availableItems.length]:null);
    cargo={...status,carrying,capacity,availablePackage:available?{...available}:null};
  }

  const assistAngle=((String(actor.id).length%2)?1:-1)*.82;
  const assistPoint={x:objective.x+Math.cos(assistAngle)*Math.max(45,(objective.interactionRadius??78)*.62),y:objective.y+Math.sin(assistAngle)*Math.max(45,(objective.interactionRadius??78)*.62)};
  return{
    ...baseContext,
    liveOperation:{
      operation,operationId,objective,objectiveId,phaseId,destination:destination?{...destination}:null,focus,contact,approach,survey,cargo,assistPoint,
      contentionActive:Boolean(
        (operation.contestedByOperationId&&["proposed","deployed"].includes(game.livingSandbox.getOperation(operation.contestedByOperationId)?.status))||
        (operation.contested&&operation.primaryOperationId&&["proposed","deployed"].includes(game.livingSandbox.getOperation(operation.primaryOperationId)?.status))
      ),
      rolePositionEstablished:Boolean(procedure.objective?.arrivedRoles?.includes(role.roleId))||Boolean(procedure.survey?.arrivedRoles?.includes(role.roleId)),
      interactionRadius:objective.interactionRadius??78,
      inspectDuration:objective.requirements?.inspectDuration??1.1,
      desiredState:mission.objectivePlan?.desiredState??operation.desiredState,
      workingState:objective.requirements?.workingState??"being_serviced",
      workVerb:objective.requirements?.workVerb??"servicing",
      completedVerb:objective.requirements?.completedVerb??"operational"
    }
  };
}

export function evaluateLiveOperationActions(context){
  const {actor,role,procedure,mission,liveOperation}=context??{};
  if(!actor||!role||!liveOperation||!LIVE_PROCEDURES.has(procedure?.procedureId))return[];
  const provenance={owner:"role_action_runtime",source:"live_operation_role",teamId:procedure.teamId,missionId:procedure.missionId,responseId:procedure.responseId,procedureId:procedure.procedureId,procedureLabel:procedure.label,phaseId:procedure.phase?.id??null,phaseLabel:procedure.phase?.label??null,roleId:role.roleId,roleLabel:role.label};
  const common={actorId:actor.id,task:mission?.immediateTask??null,operationId:liveOperation.operationId,roleId:role.roleId,roleLabel:role.label,responsibility:role.responsibility,procedureId:procedure.procedureId,procedureLabel:procedure.label,phaseId:procedure.phase?.id??null,phaseLabel:procedure.phase?.label??null,objectiveId:liveOperation.objectiveId,objectiveLabel:liveOperation.objective.label,objectivePoint:{x:liveOperation.objective.x,y:liveOperation.objective.y},desiredState:liveOperation.desiredState,workingState:liveOperation.workingState,provenance};
  const phaseId=procedure.phase?.id;

  if(phaseId==="approach_objective"&&liveOperation.rolePositionEstablished)return[{type:"HoldReady",score:.94,reason:`${role.label} preserves its established operation position.`,directive:{...common,label:"Established operation position",focus:{...liveOperation.focus},reason:`${role.label}: hold the established responsibility position`}}];
  if(phaseId==="approach_objective"&&liveOperation.destination&&procedure.permissions?.relocate)return[{type:"MoveToObjectivePosition",score:1,reason:`${role.label} must establish a separate physical position for this operation.`,directive:{...common,destination:{...liveOperation.destination},initialDistance:distance(actor,liveOperation.destination),arrivalEvent:"objective_position_reached",policy:{...mission.objectivePlan?.approachPolicy}}}];

  if(phaseId==="approach_survey_point"&&liveOperation.destination){
    const point=liveOperation.survey?.currentPoint;
    return[{type:"MoveToObjectivePosition",score:1,reason:`${role.label} advances with the patrol to ${point?.label??"the next survey point"}.`,directive:{...common,destination:{...liveOperation.destination},initialDistance:distance(actor,liveOperation.destination),arrivalEvent:"survey_position_reached",arrivalData:{pointIndex:point?.index??0,pointId:point?.id??null},policy:{speedMultiplier:.7,arrivalRadius:14,claimSpacing:62}}}];
  }

  if(liveOperation.contentionActive&&["inspect_objective","perform_objective_work"].includes(phaseId)){
    return[{type:"HoldReady",score:.98,reason:`${role.label} preserves position while the competing operation is unresolved; delicate work must not erase the encounter.`,directive:{...common,label:"Contested worksite hold",focus:{...liveOperation.focus},reason:`${role.label}: hold responsibility while the rival operation is resolved`}}];
  }

  if(phaseId==="inspect_objective"&&role.roleId==="objective_specialist"&&procedure.permissions?.inspect)return[{type:"InspectObjective",score:1,reason:`${role.label} verifies the site before the operation changes persistent world state.`,directive:{...common,duration:liveOperation.inspectDuration,completionEvent:"objective_inspected"}}];

  if(procedure.procedureId==="service_infrastructure"&&phaseId==="perform_objective_work"){
    if(role.roleId==="objective_specialist"){
      const skill=.62+(Number(actor.aiV2Capabilities?.technicalWork)||0)*.72;
      const resourceFactor=.72+(Number(liveOperation.operation.resourceCoverage)||0)*.28;
      return[{type:"PerformObjectiveWork",score:1,reason:"The Field Technician owns finite, capability-scaled service work.",directive:{...common,workRate:skill*resourceFactor,workLabel:`${liveOperation.workVerb[0]?.toUpperCase()??"S"}${liveOperation.workVerb.slice(1)} ${liveOperation.objective.label}`,completedLabel:`${liveOperation.objective.label} ${liveOperation.completedVerb}`,completionEvent:"objective_restored"}}];
    }
    if(role.roleId==="approach_lead"&&!liveOperation.contact&&procedure.permissions?.assist)return[{type:"AssistObjectiveWork",score:.72,reason:"The Route Lead has free capacity and can assist technical work without abandoning team security.",directive:{...common,assistPoint:{...liveOperation.assistPoint},reason:`${role.label}: assist the active technician`}}];
  }

  if(procedure.procedureId==="recover_supplies"&&phaseId==="collect_supplies"){
    const cargo=liveOperation.cargo;
    if(cargo?.availablePackage&&cargo.carrying<cargo.capacity){
      const packageItem=cargo.availablePackage;
      const roleScore=role.roleId==="objective_specialist"?1:role.roleId==="approach_lead"?.72:liveOperation.contact?.34:.56;
      return[{type:"CollectSupply",score:roleScore,reason:`${role.label} can physically secure a finite ${packageItem.resourceType} package within current carrying capacity.`,directive:{...common,packageId:packageItem.id,packageLabel:`${packageItem.resourceType} package`,packagePoint:{x:packageItem.x,y:packageItem.y},initialDistance:distance(actor,packageItem)}}];
    }
  }

  if(procedure.procedureId==="survey_route"&&phaseId==="record_survey_point"&&role.roleId==="objective_specialist"){
    const point=liveOperation.survey?.currentPoint;
    if(point)return[{type:"RecordSurveyPoint",score:1,reason:"The Field Recorder owns the durable observation record at the current route point.",directive:{...common,point:{...point},duration:1.05+(1-(Number(actor.aiV2Capabilities?.observation)||0))*.9}}];
  }

  if(["inspect_objective","perform_objective_work","collect_supplies","record_survey_point","objective_operational","cargo_secured","survey_complete"].includes(phaseId)){
    const contactWatch=role.roleId==="local_security"&&liveOperation.contact;
    const complete=["objective_operational","cargo_secured","survey_complete"].includes(phaseId);
    return[{type:"HoldReady",score:.63,reason:contactWatch?`${role.label} watches the reported contact while mission work continues.`:complete?`${role.label} preserves a return-ready posture.`:`${role.label} maintains spacing and security around the active responsibility.`,directive:{...common,label:contactWatch?"Reported contact watch":complete?"Return-ready operation posture":"Active operation security",focus:{...liveOperation.focus},reason:contactWatch?`${role.label}: watch contact without taking mission authority`:`${role.label}: preserve local operation security`}}];
  }
  return[];
}
