const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

function cloneArea(area){
  if(!area)return null;
  return{
    type:area.type??"circle",
    label:area.label??"mission concern area",
    x:finite(area.x,0),
    y:finite(area.y,0),
    radius:Math.max(1,finite(area.radius,1)),
    falloff:Math.max(1,finite(area.falloff,Math.max(120,finite(area.radius,1)*.55)))
  };
}

function cloneBoundaryArea(area){
  if(!area)return null;
  return{
    type:area.type??"circle",
    label:area.label??"mission boundary",
    x:finite(area.x,0),
    y:finite(area.y,0),
    radius:Math.max(1,finite(area.radius,1)),
    falloff:Math.max(1,finite(area.falloff,Math.max(100,finite(area.radius,1)*.4)))
  };
}

function normalizeBoundary(boundary){
  if(!boundary)return null;
  return{
    id:boundary.id??"mission_boundary",
    label:boundary.label??"Mission boundary",
    area:cloneBoundaryArea(boundary.area),
    policy:boundary.policy??"Unidentified armed personnel should be challenged before escalation.",
    condition:boundary.condition??"A credible mission-relevant contact is present inside the boundary.",
    warningType:boundary.warningType??"stop_and_identify",
    warningMessage:boundary.warningMessage??"Stop and identify yourselves.",
    minimumConfidence:clamp(boundary.minimumConfidence??26,0,100),
    requireActivityUpdate:boundary.requireActivityUpdate!==false,
    allowedActivities:[...(boundary.allowedActivities??["approaching","repositioning","observing","lost"])],
    voiceRange:Math.max(120,finite(boundary.voiceRange,1120)),
    coneDegrees:clamp(boundary.coneDegrees??82,20,180),
    warningDuration:Math.max(.3,finite(boundary.warningDuration,1.4)),
    awaitDuration:Math.max(1,finite(boundary.awaitDuration,12))
  };
}

function normalizeWithdrawalPlan(plan){
  if(!plan?.exitPoint)return null;
  return{
    id:plan.id??"withdrawal_route",
    label:plan.label??"withdrawal route",
    exitPoint:{x:finite(plan.exitPoint.x,0),y:finite(plan.exitPoint.y,0)},
    roleOffsets:Object.fromEntries(Object.entries(plan.roleOffsets??{}).map(([key,value])=>[key,{x:finite(value?.x,0),y:finite(value?.y,0)}])),
    speedMultiplier:clamp(plan.speedMultiplier??.62,.2,1.2),
    arrivalRadius:Math.max(4,finite(plan.arrivalRadius,12)),
    claimSpacing:Math.max(24,finite(plan.claimSpacing,68))
  };
}

function normalizeRecoveryPlan(plan){
  if(!plan?.recoveryPoint)return null;
  return{
    id:plan.id??"casualty_recovery_plan",
    label:plan.label??"recovery point",
    recoveryPoint:{x:finite(plan.recoveryPoint.x,0),y:finite(plan.recoveryPoint.y,0)},
    securitySector:plan.securitySector?{
      label:plan.securitySector.label??"recovery approach",
      x:finite(plan.securitySector.x,0),
      y:finite(plan.securitySector.y,0),
      maximumRange:Math.max(120,finite(plan.securitySector.maximumRange,900)),
      fieldOfViewDegrees:clamp(plan.securitySector.fieldOfViewDegrees??82,20,180)
    }:null,
    interactionRange:Math.max(48,finite(plan.interactionRange,82)),
    observationRange:Math.max(120,finite(plan.observationRange,640)),
    reportRange:Math.max(120,finite(plan.reportRange,520)),
    approachSpeedMultiplier:clamp(plan.approachSpeedMultiplier??.8,.2,1.2),
    dragSpeedMultiplier:clamp(plan.dragSpeedMultiplier??.46,.18,.8),
    arrivalRadius:Math.max(5,finite(plan.arrivalRadius,13)),
    claimSpacing:Math.max(24,finite(plan.claimSpacing,62)),
    stabilizationDuration:Math.max(.8,finite(plan.stabilizationDuration,3.4))
  };
}

function normalizeEvacuationPlan(plan){
  const routeOptions=(plan?.routeOptions??[])
    .map((route,index)=>({
      id:route?.id??`evacuation_route_${index+1}`,
      label:route?.label??`evacuation route ${index+1}`,
      protection:clamp(route?.protection??.5,0,1),
      cohesion:clamp(route?.cohesion??.7,0,1),
      available:route?.available!==false,
      waypoints:(route?.waypoints??[]).map((waypoint,waypointIndex)=>({
        id:waypoint?.id??`route_${index+1}_waypoint_${waypointIndex+1}`,
        label:waypoint?.label??`route waypoint ${waypointIndex+1}`,
        kind:waypoint?.kind??(waypointIndex===(route?.waypoints?.length??1)-1?"extraction":"intermediate"),
        x:finite(waypoint?.x,0),
        y:finite(waypoint?.y,0),
        staminaCost:clamp(waypoint?.staminaCost??.35,0,1)
      }))
    }))
    .filter(route=>route.waypoints.length>0);
  if(!routeOptions.length)return null;
  return{
    id:plan.id??"casualty_evacuation_plan",
    label:plan.label??"safe return route",
    routeOptions,
    rearSecuritySector:plan.rearSecuritySector?{
      label:plan.rearSecuritySector.label??"rear evacuation approach",
      x:finite(plan.rearSecuritySector.x,0),
      y:finite(plan.rearSecuritySector.y,0),
      maximumRange:Math.max(120,finite(plan.rearSecuritySector.maximumRange,900)),
      fieldOfViewDegrees:clamp(plan.rearSecuritySector.fieldOfViewDegrees??88,20,180)
    }:null,
    interactionRange:Math.max(48,finite(plan.interactionRange,82)),
    reportRange:Math.max(120,finite(plan.reportRange,560)),
    routeSecuritySpeedMultiplier:clamp(plan.routeSecuritySpeedMultiplier??.78,.2,1.2),
    transportSpeedMultiplier:clamp(plan.transportSpeedMultiplier??.42,.16,.8),
    arrivalRadius:Math.max(5,finite(plan.arrivalRadius,14)),
    claimSpacing:Math.max(24,finite(plan.claimSpacing,68)),
    routeAssessmentDuration:Math.max(.25,finite(plan.routeAssessmentDuration,.8)),
    reassessmentDuration:Math.max(.45,finite(plan.reassessmentDuration,1.25)),
    transferDuration:Math.max(.5,finite(plan.transferDuration,1.6)),
    minimumTransportStamina:clamp(plan.minimumTransportStamina??.2,0,1),
    originalMissionStatus:plan.originalMissionStatus??"suspended_for_casualty_evacuation"
  };
}

function normalizeDefensivePlan(plan){
  if(!plan)return null;
  return{
    id:plan.id??"directional_defensive_plan",
    label:plan.label??"defensive position",
    maximumCoverDistance:Math.max(80,finite(plan.maximumCoverDistance,520)),
    maximumTravel:Math.max(80,finite(plan.maximumTravel,520)),
    maximumCohesionDistance:Math.max(100,finite(plan.maximumCohesionDistance,560)),
    minimumProtection:clamp(plan.minimumProtection??.72,0,1),
    speedMultiplier:clamp(plan.speedMultiplier??.64,.2,1.2),
    arrivalRadius:Math.max(4,finite(plan.arrivalRadius,10)),
    coverGap:Math.max(2,finite(plan.coverGap,9)),
    minimumCommitmentDuration:Math.max(0,finite(plan.minimumCommitmentDuration,8)),
    switchMargin:clamp(plan.switchMargin??.18,0,.5)
  };
}

function normalizeObjectivePlan(plan){
  if(!plan?.objectiveId)return null;
  const approach=plan.approachPolicy??{};
  return{
    id:plan.id??"objective_mission_plan",
    objectiveId:plan.objectiveId,
    desiredState:plan.desiredState??"operational",
    securityFocusDistance:Math.max(120,finite(plan.securityFocusDistance,320)),
    approachPolicy:{
      maximumTravel:Math.max(200,finite(approach.maximumTravel,1400)),
      stagingDistance:Math.max(120,finite(approach.stagingDistance,250)),
      interactionDistance:Math.max(48,finite(approach.interactionDistance,68)),
      roleSpacing:Math.max(60,finite(approach.roleSpacing,105)),
      speedMultiplier:clamp(approach.speedMultiplier??.68,.2,1.2),
      arrivalRadius:Math.max(4,finite(approach.arrivalRadius,11)),
      claimSpacing:Math.max(24,finite(approach.claimSpacing,68))
    }
  };
}

function normalizeContactPolicy(policy=null){
  if(!policy)return null;
  const report=policy.report??{};
  return{
    passiveVision:policy.passiveVision!==false,
    maximumRange:Math.max(120,finite(policy.maximumRange,780)),
    fieldOfViewDegrees:clamp(policy.fieldOfViewDegrees??112,30,180),
    report:{
      method:report.method??"local_voice",
      range:Math.max(120,finite(report.range,560)),
      minimumConfidence:clamp(report.minimumConfidence??22,0,100),
      reason:report.reason??"Share a credible ambient contact with nearby teammates"
    }
  };
}

function normalizeDecisionContext(context={}){
  const bounded=(key,fallback)=>clamp(context[key]??fallback,0,1);
  return{
    missionValue:bounded("missionValue",.7),
    teamPreservation:bounded("teamPreservation",.75),
    informationNeed:bounded("informationNeed",.65),
    positionSecurity:bounded("positionSecurity",.5),
    concealmentValue:bounded("concealmentValue",.25),
    detectionRisk:bounded("detectionRisk",.35),
    timePressure:bounded("timePressure",.35),
    resourceConservation:bounded("resourceConservation",.65),
    exitOptions:bounded("exitOptions",.55),
    enemyDisruption:bounded("enemyDisruption",.35),
    securityOrientation:bounded("securityOrientation",.5),
    stealthOrientation:bounded("stealthOrientation",.5),
    mobilityOrientation:bounded("mobilityOrientation",.5),
    careOrientation:bounded("careOrientation",.5),
    positionLabel:context.positionLabel??"current position",
    exitLabel:context.exitLabel??"available route"
  };
}

function normalizeResponsePolicy(policy={}){
  return{
    minimumHold:Math.max(0,finite(policy.minimumHold,6)),
    reassessEvery:Math.max(.5,finite(policy.reassessEvery,3)),
    switchMargin:clamp(policy.switchMargin??.08,0,.5)
  };
}

function normalizeResponseBias(bias={}){
  return Object.fromEntries(Object.entries(bias).map(([key,value])=>[key,clamp(value,-.35,.35)]));
}

function normalizeMission(team){
  const authored=team?.aiV2Mission;
  if(!team?.id||!authored)return null;
  return{
    id:authored.id??`v2_mission_${team.id}`,
    teamId:team.id,
    problemKind:authored.problemKind??"external_contact",
    factionId:team.factionId??null,
    title:authored.title??team.mission??"Authored team mission",
    objective:authored.objective??team.mission??"Complete the assigned mission",
    immediateTask:authored.immediateTask??team.task??null,
    successCondition:authored.successCondition??null,
    abortCondition:authored.abortCondition??null,
    concernArea:cloneArea(authored.concernArea),
    missionSensitivity:clamp(authored.missionSensitivity??authored.problemSensitivity??.75,0,1),
    minimumRelevantConfidence:clamp(authored.minimumRelevantConfidence??8,0,100),
    incompatibleConfidence:clamp(authored.incompatibleConfidence??18,0,100),
    staleAfter:Math.max(1,authored.staleAfter??18),
    forgetAfter:Math.max(2,authored.forgetAfter??38),
    interference:authored.interference?{
      kind:authored.interference.kind??"possible_interference",
      label:authored.interference.label??"Possible mission interference",
      reason:authored.interference.reason??"The reported contact may interfere with the assigned mission."
    }:null,
    boundary:normalizeBoundary(authored.boundary),
    withdrawalPlan:normalizeWithdrawalPlan(authored.withdrawalPlan),
    recoveryPlan:normalizeRecoveryPlan(authored.recoveryPlan),
    evacuationPlan:normalizeEvacuationPlan(authored.evacuationPlan),
    defensivePlan:normalizeDefensivePlan(authored.defensivePlan),
    objectivePlan:normalizeObjectivePlan(authored.objectivePlan),
    contactPolicy:normalizeContactPolicy(authored.contactPolicy),
    decisionContext:normalizeDecisionContext(authored.decisionContext),
    responsePolicy:normalizeResponsePolicy(authored.responsePolicy),
    responseBias:normalizeResponseBias(authored.responseBias)
  };
}

export class TeamMissionStore{
  constructor(){this.byTeam=new Map();}
  syncFromGame(game){
    const teams=game?.operations?.teams??[];
    const seen=new Set();
    for(const team of teams){
      seen.add(team.id);
      const mission=normalizeMission(team);
      if(mission)this.byTeam.set(team.id,mission);
      else this.byTeam.delete(team.id);
    }
    for(const teamId of [...this.byTeam.keys()])if(!seen.has(teamId))this.byTeam.delete(teamId);
  }
  get(teamId){return this.byTeam.get(teamId)??null;}
  has(teamId){return this.byTeam.has(teamId);}
  summary(){
    return [...this.byTeam.values()].map(mission=>({
      ...mission,
      concernArea:mission.concernArea?{...mission.concernArea}:null,
      interference:mission.interference?{...mission.interference}:null,
      boundary:mission.boundary?{...mission.boundary,area:mission.boundary.area?{...mission.boundary.area}:null,allowedActivities:[...mission.boundary.allowedActivities]}:null,
      withdrawalPlan:mission.withdrawalPlan?{...mission.withdrawalPlan,exitPoint:{...mission.withdrawalPlan.exitPoint},roleOffsets:Object.fromEntries(Object.entries(mission.withdrawalPlan.roleOffsets??{}).map(([key,value])=>[key,{...value}]))}:null,
      recoveryPlan:mission.recoveryPlan?{...mission.recoveryPlan,recoveryPoint:{...mission.recoveryPlan.recoveryPoint},securitySector:mission.recoveryPlan.securitySector?{...mission.recoveryPlan.securitySector}:null}:null,
      evacuationPlan:mission.evacuationPlan?{
        ...mission.evacuationPlan,
        routeOptions:mission.evacuationPlan.routeOptions.map(route=>({...route,waypoints:route.waypoints.map(waypoint=>({...waypoint}))})),
        rearSecuritySector:mission.evacuationPlan.rearSecuritySector?{...mission.evacuationPlan.rearSecuritySector}:null
      }:null,
      defensivePlan:mission.defensivePlan?{...mission.defensivePlan}:null,
      objectivePlan:mission.objectivePlan?{...mission.objectivePlan,approachPolicy:{...mission.objectivePlan.approachPolicy}}:null,
      contactPolicy:mission.contactPolicy?{...mission.contactPolicy,report:{...mission.contactPolicy.report}}:null,
      decisionContext:{...mission.decisionContext},
      responsePolicy:{...mission.responsePolicy},
      responseBias:{...mission.responseBias}
    }));
  }
}
