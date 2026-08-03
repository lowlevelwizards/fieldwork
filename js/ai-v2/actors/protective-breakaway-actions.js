const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

function activeZone(game){
  return game?.map?.sandboxLayout?.zones?.find(zone=>zone.id===game.sandboxFixtureId)??null;
}

function clampToZone(point,zone,padding=30){
  if(!zone)return point;
  return{
    x:clamp(point.x,zone.x+padding,zone.x+zone.width-padding),
    y:clamp(point.y,zone.y+padding,zone.y+zone.height-padding)
  };
}

function withdrawalMovement({mission,role,actor,game}){
  const plan=mission?.withdrawalPlan;
  const routeRole=role?.fulfillment?.routeRole??role?.roleId;
  if(!plan?.exitPoint||!routeRole)return null;
  const offset=plan.roleOffsets?.[routeRole]??{x:0,y:0};
  const destination=clampToZone({
    x:plan.exitPoint.x+(offset.x??0),
    y:plan.exitPoint.y+(offset.y??0)
  },activeZone(game));
  return{
    routeId:plan.id,
    routeLabel:plan.label,
    destination,
    policy:{
      speedMultiplier:plan.speedMultiplier??.72,
      arrivalRadius:plan.arrivalRadius??12,
      claimSpacing:plan.claimSpacing??68
    },
    initialDistance:Math.hypot(destination.x-actor.x,destination.y-actor.y)
  };
}

function commonDirective(context){
  const {role,procedure,mission}=context;
  const provenance={
    owner:"role_action_runtime",
    source:"procedure_role",
    teamId:procedure.teamId,
    missionId:procedure.missionId,
    responseId:procedure.responseId,
    procedureId:procedure.procedureId,
    procedureLabel:procedure.label,
    phaseId:procedure.phase?.id??null,
    phaseLabel:procedure.phase?.label??null,
    roleId:role.roleId,
    roleLabel:role.label
  };
  return{
    task:mission?.immediateTask??null,
    roleId:role.roleId,
    roleLabel:role.label,
    responsibility:role.responsibility,
    procedureId:procedure.procedureId,
    procedureLabel:procedure.label,
    phaseId:procedure.phase?.id??null,
    phaseLabel:procedure.phase?.label??null,
    provenance
  };
}

export function extendProtectiveBreakawayContext(context,{game,actor,role,procedure,mission}={}){
  if(role?.fulfillment?.need!=="protective_fire_then_withdraw")return context;
  return{
    ...context,
    protectiveBreakaway:{
      movement:withdrawalMovement({mission,role,actor,game}),
      targetPoint:context.contactPosition?{...context.contactPosition}:null,
      maximumRounds:role.fulfillment.maximumRounds??4,
      fireInterval:role.fulfillment.fireInterval??.26
    }
  };
}

export function evaluateProtectiveBreakawayActions(context){
  const {role,procedure,protectiveBreakaway}=context??{};
  if(role?.fulfillment?.need!=="protective_fire_then_withdraw"||!procedure)return[];
  const common=commonDirective(context);
  if(procedure.phase?.id===role.fulfillment.stageId&&protectiveBreakaway?.movement?.destination&&procedure.permissions?.relocate){
    const movement=protectiveBreakaway.movement;
    return[{
      type:"WithdrawToRoute",
      score:1,
      reason:`${role.label} stops firing and disengages last after both protected movers reach safety.`,
      directive:{
        ...common,
        reason:`${role.label}: ${role.responsibility}`,
        routeId:movement.routeId,
        routeLabel:movement.routeLabel,
        destination:{...movement.destination},
        policy:{...movement.policy},
        initialDistance:movement.initialDistance
      }
    }];
  }
  if(["lead_movement","protected_movement"].includes(procedure.phase?.id)&&protectiveBreakaway?.targetPoint&&procedure.permissions?.fire){
    return[{
      type:"ProtectiveFire",
      score:1,
      reason:`${role.label} provides a finite protective burst while the current mover leaves the exposed lane.`,
      directive:{
        ...common,
        reason:`${role.label}: ${role.responsibility}`,
        targetPoint:{...protectiveBreakaway.targetPoint},
        maximumRounds:protectiveBreakaway.maximumRounds,
        fireInterval:protectiveBreakaway.fireInterval,
        spread:.052
      }
    }];
  }
  return[];
}
