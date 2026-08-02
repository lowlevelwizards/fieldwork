const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));


function boundaryAssessment(boundary,encounter,informationCertainty){
  if(!boundary?.area||!encounter?.approximatePosition)return{
    established:false,inside:false,proximity:0,trigger:false,label:"no mission boundary",policy:null
  };
  const dx=encounter.approximatePosition.x-boundary.area.x;
  const dy=encounter.approximatePosition.y-boundary.area.y;
  const distance=Math.hypot(dx,dy);
  const inside=distance<=boundary.area.radius;
  const proximity=inside
    ?clamp(1-(distance/Math.max(1,boundary.area.radius))*.18,.82,1)
    :clamp(1-(distance-boundary.area.radius)/Math.max(1,boundary.area.falloff),0,.78);
  const activityAllowed=boundary.allowedActivities?.includes(encounter.activity)??false;
  const activityReady=boundary.requireActivityUpdate?encounter.reportKind==="activity_update"&&activityAllowed:true;
  const confidenceReady=(encounter.reportConfidence??0)>=boundary.minimumConfidence;
  const trigger=inside&&activityReady&&confidenceReady&&encounter.intent!=="hostile"&&!encounter.warningIssued;
  return{
    established:true,
    inside,
    distance,
    proximity,
    activityAllowed,
    activityReady,
    confidenceReady,
    trigger,
    label:boundary.label,
    policy:boundary.policy,
    warningType:boundary.warningType
  };
}

function copyContext(context={}){
  return{
    missionValue:clamp(context.missionValue??.7),
    teamPreservation:clamp(context.teamPreservation??.75),
    informationNeed:clamp(context.informationNeed??.65),
    positionSecurity:clamp(context.positionSecurity??.5),
    concealmentValue:clamp(context.concealmentValue??.25),
    detectionRisk:clamp(context.detectionRisk??.35),
    timePressure:clamp(context.timePressure??.35),
    resourceConservation:clamp(context.resourceConservation??.65),
    exitOptions:clamp(context.exitOptions??.55),
    enemyDisruption:clamp(context.enemyDisruption??.35),
    securityOrientation:clamp(context.securityOrientation??.5),
    stealthOrientation:clamp(context.stealthOrientation??.5),
    mobilityOrientation:clamp(context.mobilityOrientation??.5),
    positionLabel:context.positionLabel??"current position",
    exitLabel:context.exitLabel??"available route"
  };
}

export function buildTeamDecisionLedger({mission,encounter}={}){
  if(!mission||!encounter)return null;
  const context=copyContext(mission.decisionContext);
  const informationCertainty=clamp((encounter.reportConfidence??0)/100*.82);
  const encounterRelevance=clamp(encounter.relevanceScore??0);
  const hostileEvidence=encounter.intent==="hostile"?1:0;
  const unknownIntent=encounter.intent==="unknown"||encounter.intent==="no_clear_intent"?1:0;
  const boundary=boundaryAssessment(mission.boundary,encounter,informationCertainty);
  const activityEvidence=encounter.reportKind==="activity_update"?1:0;
  const reversibleCommunicationValue=hostileEvidence?0:1;
  const warningHeard=encounter.warningHeard?1:0;
  const warningIssued=encounter.warningIssued?1:0;
  const departureEvidence=encounter.departureObservedAfterWarning?1:0;
  const withdrawalPlanAvailable=mission.withdrawalPlan?.exitPoint?1:0;
  return{
    teamId:mission.teamId,
    missionId:mission.id,
    encounterSubjectId:encounter.subjectId,
    encounterState:encounter.state,
    missionValue:context.missionValue,
    teamPreservation:context.teamPreservation,
    informationNeed:context.informationNeed,
    informationCertainty,
    informationUncertainty:1-informationCertainty,
    encounterRelevance,
    positionSecurity:context.positionSecurity,
    concealmentValue:context.concealmentValue,
    detectionRisk:context.detectionRisk,
    timePressure:context.timePressure,
    lowTimePressure:1-context.timePressure,
    resourceConservation:context.resourceConservation,
    exitOptions:context.exitOptions,
    enemyDisruption:context.enemyDisruption,
    securityOrientation:context.securityOrientation,
    stealthOrientation:context.stealthOrientation,
    mobilityOrientation:context.mobilityOrientation,
    hostileEvidence,
    unknownIntent,
    activityEvidence,
    boundaryEstablished:boundary.established?1:0,
    boundaryInside:boundary.inside?1:0,
    boundaryProximity:boundary.proximity,
    boundaryTrigger:boundary.trigger?1:0,
    boundaryLabel:boundary.label,
    boundaryPolicy:boundary.policy,
    boundaryWarningType:boundary.warningType,
    reversibleCommunicationValue,
    warningHeard,
    warningIssued,
    departureEvidence,
    withdrawalPlanAvailable,
    positionLabel:context.positionLabel,
    exitLabel:context.exitLabel,
    evidenceLabel:`${Math.round(encounter.reportConfidence??0)}% second-hand contact report`,
    responseBias:{...(mission.responseBias??{})}
  };
}
