const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

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
  const unknownIntent=encounter.intent==="unknown"?1:0;
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
    positionLabel:context.positionLabel,
    exitLabel:context.exitLabel,
    evidenceLabel:`${Math.round(encounter.reportConfidence??0)}% second-hand contact report`,
    responseBias:{...(mission.responseBias??{})}
  };
}
