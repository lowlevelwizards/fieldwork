const distance=(a,b)=>Math.hypot((a?.x??0)-(b?.x??0),(a?.y??0)-(b?.y??0));

export function extendObjectiveMissionContext(baseContext,{game,actor,role,procedure,mission,objectives,objectiveApproaches,now=0}={}){
  if(procedure?.procedureId!=="restore_field_relay")return baseContext;
  const objectiveId=mission?.objectivePlan?.objectiveId??null;
  const objective=objectiveId?objectives?.get?.(objectiveId):null;
  if(!objective)return{...baseContext,objectiveMission:null};
  const teamActors=(game?.actors??[]).filter(candidate=>candidate.teamId===actor.teamId&&!candidate.medical?.dead);
  const approach=objectiveApproaches?.getOrSelect?.({game,teamId:actor.teamId,objective,teamActors,plan:mission.objectivePlan?.approachPolicy??{},now})??null;
  const destination=approach?.rolePoints?.[role.roleId]??null;
  const forward=approach?{x:-approach.vector.x,y:-approach.vector.y}:{x:0,y:-1};
  const focus={x:objective.x+forward.x*(mission.objectivePlan?.securityFocusDistance??320),y:objective.y+forward.y*(mission.objectivePlan?.securityFocusDistance??320)};
  return{
    ...baseContext,
    objectiveMission:{
      objective,
      objectiveId,
      approach,
      destination:destination?{...destination}:null,
      focus,
      distanceToObjective:distance(actor,objective),
      interactionRadius:objective.interactionRadius??78,
      inspectDuration:objective.requirements?.inspectDuration??1.2,
      desiredState:mission.objectivePlan?.desiredState??"operational"
    }
  };
}

export function evaluateObjectiveMissionActions(context){
  const {actor,role,procedure,mission,objectiveMission}=context??{};
  if(!actor||!role||procedure?.procedureId!=="restore_field_relay"||!objectiveMission?.objective)return[];
  const provenance={
    owner:"role_action_runtime",source:"objective_mission_role",teamId:procedure.teamId,missionId:procedure.missionId,
    responseId:procedure.responseId,procedureId:procedure.procedureId,procedureLabel:procedure.label,
    phaseId:procedure.phase?.id??null,phaseLabel:procedure.phase?.label??null,roleId:role.roleId,roleLabel:role.label
  };
  const common={
    actorId:actor.id,task:mission?.immediateTask??null,roleId:role.roleId,roleLabel:role.label,
    responsibility:role.responsibility,procedureId:procedure.procedureId,procedureLabel:procedure.label,
    phaseId:procedure.phase?.id??null,phaseLabel:procedure.phase?.label??null,
    objectiveId:objectiveMission.objectiveId,objectiveLabel:objectiveMission.objective.label,
    objectivePoint:{x:objectiveMission.objective.x,y:objectiveMission.objective.y},provenance
  };
  const phaseId=procedure.phase?.id;

  if(phaseId==="approach_objective"&&objectiveMission.destination&&procedure.permissions?.relocate){
    return[{type:"MoveToObjectivePosition",score:1,reason:`${role.label} must physically establish its distinct objective position before work can begin.`,directive:{
      ...common,reason:`${role.label}: ${role.responsibility}`,destination:{...objectiveMission.destination},
      initialDistance:distance(actor,objectiveMission.destination),policy:{
        speedMultiplier:mission.objectivePlan?.approachPolicy?.speedMultiplier??.68,
        arrivalRadius:mission.objectivePlan?.approachPolicy?.arrivalRadius??11,
        claimSpacing:mission.objectivePlan?.approachPolicy?.claimSpacing??68
      }
    }}];
  }

  if(phaseId==="inspect_objective"&&role.roleId==="objective_specialist"&&procedure.permissions?.inspect){
    return[{type:"InspectObjective",score:1,reason:"The Objective Specialist must inspect the relay from physical interaction range before restoration work begins.",directive:{...common,reason:`${role.label}: inspect ${objectiveMission.objective.label}`,duration:objectiveMission.inspectDuration}}];
  }

  if(phaseId==="perform_objective_work"&&role.roleId==="objective_specialist"&&procedure.permissions?.work){
    return[{type:"PerformObjectiveWork",score:1,reason:"The Objective Specialist owns the finite technical work required to change the relay's world state.",directive:{...common,reason:`${role.label}: restore ${objectiveMission.objective.label}`}}];
  }

  if(["inspect_objective","perform_objective_work","objective_operational"].includes(phaseId)){
    const completed=phaseId==="objective_operational";
    return[{type:"HoldReady",score:.92,reason:completed
      ?`${role.label} maintains a coherent worksite posture around the restored objective.`
      :`${role.label} preserves local security while the Objective Specialist works.`,directive:{
        ...common,reason:completed?`${role.label}: hold the completed worksite`:`${role.label}: preserve worksite security`,
        label:completed?"Completed objective perimeter":"Objective worksite security",focus:{...objectiveMission.focus}
      }}];
  }

  return[];
}
