const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function centroid(actors){
  if(!actors.length)return{x:0,y:0};
  return{
    x:actors.reduce((sum,actor)=>sum+actor.x,0)/actors.length,
    y:actors.reduce((sum,actor)=>sum+actor.y,0)/actors.length
  };
}

function rotate(angle,degrees){return angle+degrees*Math.PI/180;}
function pointAt(origin,angle,distance){return{x:origin.x+Math.cos(angle)*distance,y:origin.y+Math.sin(angle)*distance};}

function activeZone(game){
  return game?.map?.sandboxLayout?.zones?.find(zone=>zone.id===game.sandboxFixtureId)??null;
}

function clampToZone(point,zone,padding=60){
  if(!zone)return point;
  return{
    x:clamp(point.x,zone.x+padding,zone.x+zone.width-padding),
    y:clamp(point.y,zone.y+padding,zone.y+zone.height-padding)
  };
}

function bestContactPosition({teamKnowledge,teamEncounters,teamId,mission,teamCenter}){
  const encounter=teamEncounters?.getBestTeamHypothesis?.(teamId)??null;
  if(encounter?.approximatePosition)return{...encounter.approximatePosition};
  const report=teamKnowledge?.getBestTeamContact?.(teamId)??null;
  if(report?.approximatePosition)return{...report.approximatePosition};
  if(mission?.concernArea)return{x:mission.concernArea.x,y:mission.concernArea.y};
  return{x:teamCenter.x,y:teamCenter.y-320};
}

function authoredObserverSector(actor){
  const assignment=actor?.aiV2Assignment;
  if(assignment?.action!=="observe_sector"||!assignment.sector)return null;
  return{
    ...assignment.sector,
    label:assignment.sector.label??"Assigned contact sector"
  };
}

function withdrawalMovement({mission,role,actor,zone}){
  const plan=mission?.withdrawalPlan;
  const routeRole=role?.fulfillment?.routeRole??role?.roleId;
  if(!plan?.exitPoint||!routeRole)return null;
  const offset=plan.roleOffsets?.[routeRole]??{x:0,y:0};
  const destination=clampToZone({x:plan.exitPoint.x+(offset.x??0),y:plan.exitPoint.y+(offset.y??0)},zone,30);
  return{
    routeId:plan.id,
    routeLabel:plan.label,
    stageId:role.fulfillment.stageId,
    destination,
    policy:{
      speedMultiplier:plan.speedMultiplier??.62,
      arrivalRadius:plan.arrivalRadius??12,
      claimSpacing:plan.claimSpacing??68
    },
    initialDistance:Math.hypot(destination.x-actor.x,destination.y-actor.y)
  };
}

export function buildRoleActionContext({game,actor,role,procedure,mission,teamKnowledge,teamEncounters,casualtyKnowledge,evacuationRoutes,currentObserveAction=null}={}){
  const teamActors=(game?.actors??[]).filter(candidate=>candidate.teamId===actor?.teamId&&!candidate.medical?.dead);
  const teamCenter=centroid(teamActors);
  const contactPosition=bestContactPosition({teamKnowledge,teamEncounters,teamId:actor?.teamId,mission,teamCenter});
  const mainAngle=Math.atan2(contactPosition.y-teamCenter.y,contactPosition.x-teamCenter.x);
  const zone=activeZone(game);
  const need=role?.fulfillment?.need??null;

  let sector=null;
  let focus=null;
  let warning=null;
  let movement=null;
  let recovery=null;
  let evacuation=null;
  let label=role?.label??"Assigned responsibility";

  if(need==="observe_contact"){
    sector=authoredObserverSector(actor)??{
      label:role.fulfillment.label??"Reported contact sector",
      x:contactPosition.x,
      y:contactPosition.y,
      maximumRange:role.fulfillment.maximumRange??1180,
      fieldOfViewDegrees:role.fulfillment.fieldOfViewDegrees??72
    };
  }else if(need==="observe_alternate_approach"){
    const retainedSector=currentObserveAction?.metadata?.provenance?.roleId===role.roleId
      ?currentObserveAction.assignment?.sector
      :null;
    if(retainedSector){
      sector={...retainedSector};
    }else{
      const side=actor.x<teamCenter.x?-1:1;
      const angle=rotate(mainAngle,side*(role.fulfillment.angularOffsetDegrees??55));
      const target=clampToZone(pointAt(actor,angle,role.fulfillment.distance??520),zone);
      sector={
        label:role.fulfillment.label??"Alternate approach",
        x:target.x,
        y:target.y,
        maximumRange:role.fulfillment.maximumRange??900,
        fieldOfViewDegrees:role.fulfillment.fieldOfViewDegrees??70
      };
    }
  }else if(need==="hold_rear_ready"){
    const angle=rotate(mainAngle,180+(role.fulfillment.angularOffsetDegrees??0));
    focus=clampToZone(pointAt(actor,angle,role.fulfillment.distance??340),zone);
    label=role.fulfillment.label??"Rear ready sector";
  }else if(need==="issue_warning"){
    focus={...contactPosition};
    label=procedure?.phase?.id==="await_response"?"Await challenged sector":role.fulfillment.label??"Reported contact sector";
    warning={
      subjectId:teamEncounters?.getBestTeamHypothesis?.(actor?.teamId)?.subjectId??null,
      targetPoint:{...contactPosition},
      warningType:mission?.boundary?.warningType??"stop_and_identify",
      message:mission?.boundary?.warningMessage??"Stop and identify yourselves.",
      boundary:mission?.boundary?{
        ...mission.boundary,
        area:mission.boundary.area?{...mission.boundary.area}:null,
        allowedActivities:[...(mission.boundary.allowedActivities??[])]
      }:null
    };
  }else if(need==="staged_withdrawal"){
    movement=withdrawalMovement({mission,role,actor,zone});
    focus={...contactPosition};
    label=role.fulfillment.waitingLabel??mission?.withdrawalPlan?.label??"Withdrawal route";
  }else if(need==="rear_watch_then_withdraw"){
    movement=withdrawalMovement({mission,role,actor,zone});
    if(procedure?.phase?.id===role.fulfillment.stageId){
      focus={...contactPosition};
      label=mission?.withdrawalPlan?.label??"Withdrawal route";
    }else{
      sector={
        label:role.fulfillment.label??"Warned contact sector",
        x:contactPosition.x,
        y:contactPosition.y,
        maximumRange:role.fulfillment.maximumRange??1280,
        fieldOfViewDegrees:role.fulfillment.fieldOfViewDegrees??78
      };
    }
  }else if(need==="observe_recovery_approach"){
    const authored=mission?.recoveryPlan?.securitySector;
    if(authored)sector={...authored};
  }else if(["transport_casualty","secure_evacuation_route","rear_security_evacuation"].includes(need)){
    const hypothesis=(teamEncounters?.getTeamHypotheses?.(actor?.teamId)??[]).find(candidate=>candidate.subjectKind==="friendly_casualty")??null;
    const casualtyId=hypothesis?.subjectId??null;
    const casualty=game?.actors?.find(candidate=>candidate.id===casualtyId)??null;
    const plan=mission?.evacuationPlan;
    const selected=evacuationRoutes?.getSelected?.(actor?.teamId)??null;
    const state=procedure?.evacuation??null;
    const waypoints=(state?.waypoints?.length?state.waypoints:selected?.waypoints)??[];
    const legIndex=Math.max(0,state?.currentLegIndex??0);
    const waypoint=waypoints[legIndex]??waypoints.at(-1)??null;
    const finalLeg=Boolean(waypoint&&legIndex===waypoints.length-1);
    if(casualty&&plan){
      const interactionRange=plan.interactionRange??82;
      const approachAngle=Math.atan2(actor.y-casualty.y,actor.x-casualty.x);
      const approachDistance=Math.max(44,interactionRange*.68);
      const approachDestination=clampToZone({
        x:casualty.x+Math.cos(approachAngle)*approachDistance,
        y:casualty.y+Math.sin(approachAngle)*approachDistance
      },zone,24);
      evacuation={
        casualtyId:casualty.id,
        casualtyName:casualty.name,
        casualtyPosition:{x:casualty.x,y:casualty.y},
        distanceToCasualty:Math.hypot(casualty.x-actor.x,casualty.y-actor.y),
        approachDestination,
        initialApproachDistance:Math.hypot(approachDestination.x-actor.x,approachDestination.y-actor.y),
        routeId:state?.routeId??selected?.id??null,
        routeLabel:state?.routeLabel??selected?.label??plan.label,
        candidateCount:state?.candidateCount??selected?.candidateCount??plan.routeOptions?.length??0,
        waypoints:waypoints.map(item=>({...item})),
        legIndex,
        waypoint:waypoint?{...waypoint}:null,
        finalLeg,
        destination:waypoint?{x:waypoint.x,y:waypoint.y}:null,
        initialDistance:waypoint?Math.hypot(waypoint.x-actor.x,waypoint.y-actor.y):0,
        interactionRange,
        approachSpeedMultiplier:plan.approachSpeedMultiplier??.8,
        reportRange:plan.reportRange??560,
        routeAssessmentDuration:plan.routeAssessmentDuration??.8,
        reassessmentDuration:plan.reassessmentDuration??1.25,
        transferDuration:plan.transferDuration??1.6,
        minimumTransportStamina:plan.minimumTransportStamina??.2,
        staminaCost:waypoint?.staminaCost??.35,
        routePolicy:{speedMultiplier:plan.routeSecuritySpeedMultiplier??.78,arrivalRadius:plan.arrivalRadius??14,claimSpacing:plan.claimSpacing??68},
        transportPolicy:{speedMultiplier:plan.transportSpeedMultiplier??.42,arrivalRadius:plan.arrivalRadius??14,claimSpacing:plan.claimSpacing??68},
        currentTransportStamina:Number(actor.aiV2Capabilities?.transportStamina??0),
        carrierHandoffs:state?.carrierHandoffs??0
      };
      focus=waypoint?{x:waypoint.x,y:waypoint.y}:{x:casualty.x,y:casualty.y};
      label=waypoint?.label??plan.label??"Evacuation route";
      if(need==="rear_security_evacuation"){
        const authored=plan.rearSecuritySector;
        sector=authored?{...authored}:{label:"Rear evacuation approach",x:teamCenter.x,y:teamCenter.y-420,maximumRange:900,fieldOfViewDegrees:88};
      }
    }
  }else if(need==="recover_casualty"){
    const hypothesis=(teamEncounters?.getTeamHypotheses?.(actor?.teamId)??[]).find(candidate=>candidate.subjectKind==="friendly_casualty")??null;
    const casualtyId=hypothesis?.subjectId??null;
    const casualty=game?.actors?.find(candidate=>candidate.id===casualtyId)??null;
    const plan=mission?.recoveryPlan;
    if(casualty&&plan?.recoveryPoint){
      const interactionRange=plan.interactionRange??82;
      const angle=Math.atan2(actor.y-casualty.y,actor.x-casualty.x);
      const approachDestination=clampToZone({
        x:casualty.x+Math.cos(angle)*Math.max(44,interactionRange*.68),
        y:casualty.y+Math.sin(angle)*Math.max(44,interactionRange*.68)
      },zone,24);
      recovery={
        casualtyId:casualty.id,
        casualtyName:casualty.name,
        casualtyPosition:{x:casualty.x,y:casualty.y},
        approachDestination,
        recoveryPoint:{...plan.recoveryPoint},
        interactionRange,
        reportRange:plan.reportRange??520,
        approachSpeedMultiplier:plan.approachSpeedMultiplier??.8,
        dragSpeedMultiplier:plan.dragSpeedMultiplier??.46,
        arrivalRadius:plan.arrivalRadius??13,
        claimSpacing:plan.claimSpacing??62,
        stabilizationDuration:plan.stabilizationDuration??3.4,
        assessment:casualtyKnowledge?.getBestTeamCasualty?.(actor.teamId)?.assessment??hypothesis.casualty??null,
        initialApproachDistance:Math.hypot(approachDestination.x-actor.x,approachDestination.y-actor.y),
        initialDragDistance:Math.hypot(plan.recoveryPoint.x-actor.x,plan.recoveryPoint.y-actor.y)
      };
      focus={...plan.recoveryPoint};
      label=plan.label??"Recovery point";
    }
  }

  return{
    actor,
    role,
    procedure,
    mission,
    teamActors,
    teamCenter,
    contactPosition,
    mainAngle,
    sector,
    focus,
    warning,
    movement,
    recovery,
    evacuation,
    label,
    permissions:{...(procedure?.permissions??{})}
  };
}
