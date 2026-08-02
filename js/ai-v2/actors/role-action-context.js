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

export function buildRoleActionContext({game,actor,role,procedure,mission,teamKnowledge,teamEncounters,currentObserveAction=null}={}){
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
    label,
    permissions:{...(procedure?.permissions??{})}
  };
}
