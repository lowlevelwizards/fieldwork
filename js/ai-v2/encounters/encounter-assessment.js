const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export const ENCOUNTER_STATES=Object.freeze({
  NONE:"none",
  POSSIBLE:"possible",
  RELEVANT:"relevant",
  POTENTIALLY_INCOMPATIBLE:"potentially_incompatible",
  STALE:"stale"
});

function spatialAssessment(area,position){
  if(!area||!position)return{inside:false,distance:null,proximity:0,label:"no mission area"};
  const distance=Math.hypot(position.x-area.x,position.y-area.y);
  const inside=distance<=area.radius;
  const proximity=inside
    ?clamp(1-(distance/Math.max(1,area.radius))*.22,.78,1)
    :clamp(1-(distance-area.radius)/Math.max(1,area.falloff),0,.72);
  return{inside,distance,proximity,label:area.label};
}

function relevanceLabel(score){
  if(score>=.72)return"high";
  if(score>=.42)return"moderate";
  if(score>0)return"low";
  return"none";
}

function activityModifier(activity){
  switch(activity){
    case"approaching":return .12;
    case"repositioning":return .06;
    case"observing":return .05;
    case"withdrawing":return -.06;
    case"lost":return -.1;
    default:return 0;
  }
}

function activitySentence(report){
  if(report.reportKind!=="activity_update"||!report.activity)return null;
  const label=report.activityLabel??String(report.activity).replaceAll("_"," ");
  const intent=report.intentHypothesis?.label??"No clear intent";
  return`Latest reported activity: ${label}. Intent remains a hypothesis: ${intent}.`;
}

export function assessEncounterHypothesis({mission,report,heardWarning=null,outgoingWarning=null,now=0}={}){
  if(!mission||!report)return null;
  const age=Math.max(0,now-(report.reportedAt??now));
  const confidence=clamp(report.confidence??0,0,100);
  const spatial=spatialAssessment(mission.concernArea,report.approximatePosition);
  const confidenceWeight=.48+.52*(confidence/100);
  const activityAdjustment=activityModifier(report.activity);
  let relevanceScore=clamp(spatial.proximity*mission.missionSensitivity*confidenceWeight+activityAdjustment,0,1);
  const stale=age>=mission.staleAfter||confidence<4;
  let state=ENCOUNTER_STATES.POSSIBLE;
  let reason="A contact report exists, but its relationship to the mission remains uncertain.";

  if(stale){
    state=ENCOUNTER_STATES.STALE;
    reason="The mission-relevant report is now too old or uncertain to support a current conclusion.";
  }else if(spatial.inside&&confidence>=mission.incompatibleConfidence&&mission.interference){
    state=ENCOUNTER_STATES.POTENTIALLY_INCOMPATIBLE;
    reason=mission.interference.reason;
  }else if(spatial.proximity>.18&&confidence>=mission.minimumRelevantConfidence){
    state=ENCOUNTER_STATES.RELEVANT;
    reason=mission.interference?.reason??"The reported contact is close enough to affect the assigned mission.";
  }

  const activityEvidence=activitySentence(report);
  if(activityEvidence&&!stale)reason=`${reason} ${activityEvidence}`;
  if(heardWarning&&!stale){
    relevanceScore=clamp(relevanceScore+.08,0,1);
    reason=`${reason} A directed warning was heard from the contact area, increasing confidence that the team may have been detected.`;
  }
  if(outgoingWarning&&!stale){
    reason=`${reason} The team has issued a boundary warning and is awaiting an observable response.`;
  }

  return{
    teamId:mission.teamId,
    missionId:mission.id,
    reportId:report.id,
    reportKind:report.reportKind??"initial_contact",
    subjectId:report.subjectId,
    sourceActorId:report.sourceActorId,
    evidenceType:report.reportKind==="activity_update"?"communicated_activity_update":"communicated_contact_report",
    state,
    previousState:null,
    missionRelevance:relevanceLabel(relevanceScore),
    relevanceScore,
    reportConfidence:confidence,
    reportAge:age,
    approximatePosition:{...report.approximatePosition},
    previousApproximatePosition:report.previousApproximatePosition?{...report.previousApproximatePosition}:null,
    spatial:{...spatial},
    identity:report.identity??"unknown",
    factionId:report.factionId??null,
    activity:report.activity??null,
    activityLabel:report.activityLabel??null,
    activityRevision:report.activityRevision??0,
    movementDirection:report.movementDirection??null,
    estimatedSpeed:report.estimatedSpeed??0,
    intent:report.intentHypothesis?.id??"unknown",
    intentHypothesis:report.intentHypothesis?{...report.intentHypothesis}:null,
    warningHeard:Boolean(heardWarning),
    heardWarning:heardWarning?{...heardWarning,targetPoint:heardWarning.targetPoint?{...heardWarning.targetPoint}:null,approximateSourcePosition:heardWarning.approximateSourcePosition?{...heardWarning.approximateSourcePosition}:null,recipientIds:[...(heardWarning.recipientIds??[])]}:null,
    warningIssued:Boolean(outgoingWarning),
    departureObserved:["withdrawing","lost"].includes(report.activity),
    departureObservedAfterWarning:Boolean(outgoingWarning&&["withdrawing","lost"].includes(report.activity)&&(report.reportedAt??now)>=(outgoingWarning.issuedAt??0)),
    outgoingWarning:outgoingWarning?{...outgoingWarning,targetPoint:outgoingWarning.targetPoint?{...outgoingWarning.targetPoint}:null,approximateSourcePosition:outgoingWarning.approximateSourcePosition?{...outgoingWarning.approximateSourcePosition}:null,recipientIds:[...(outgoingWarning.recipientIds??[])]}:null,
    interferenceKind:mission.interference?.kind??null,
    interferenceLabel:mission.interference?.label??null,
    reason,
    response:null,
    assessedAt:now,
    lastEvidenceAt:report.reportedAt??now,
    forgetAfter:mission.forgetAfter
  };
}
