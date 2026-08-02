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
    decisionContext:normalizeDecisionContext(authored.decisionContext),
    responsePolicy:normalizeResponsePolicy(authored.responsePolicy),
    responseBias:normalizeResponseBias(authored.responseBias)
  };
}

export class TeamMissionStore{
  constructor(){
    this.byTeam=new Map();
  }

  syncFromGame(game){
    const teams=game?.operations?.teams??[];
    for(const team of teams){
      const mission=normalizeMission(team);
      if(mission)this.byTeam.set(team.id,mission);
    }
  }

  get(teamId){
    return this.byTeam.get(teamId)??null;
  }

  has(teamId){
    return this.byTeam.has(teamId);
  }

  summary(){
    return [...this.byTeam.values()].map(mission=>({
      ...mission,
      concernArea:mission.concernArea?{...mission.concernArea}:null,
      interference:mission.interference?{...mission.interference}:null,
      boundary:mission.boundary?{...mission.boundary,area:mission.boundary.area?{...mission.boundary.area}:null,allowedActivities:[...mission.boundary.allowedActivities]}:null,
      withdrawalPlan:mission.withdrawalPlan?{...mission.withdrawalPlan,exitPoint:{...mission.withdrawalPlan.exitPoint},roleOffsets:Object.fromEntries(Object.entries(mission.withdrawalPlan.roleOffsets??{}).map(([key,value])=>[key,{...value}]))}:null,
      recoveryPlan:mission.recoveryPlan?{...mission.recoveryPlan,recoveryPoint:{...mission.recoveryPlan.recoveryPoint},securitySector:mission.recoveryPlan.securitySector?{...mission.recoveryPlan.securitySector}:null}:null,
      decisionContext:{...mission.decisionContext},
      responsePolicy:{...mission.responsePolicy},
      responseBias:{...mission.responseBias}
    }));
  }
}
