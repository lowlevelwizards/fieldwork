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

export function assessEncounterHypothesis({mission,report,now=0}={}){
  if(!mission||!report)return null;
  const age=Math.max(0,now-(report.reportedAt??now));
  const confidence=clamp(report.confidence??0,0,100);
  const spatial=spatialAssessment(mission.concernArea,report.approximatePosition);
  const confidenceWeight=.48+.52*(confidence/100);
  const relevanceScore=clamp(spatial.proximity*mission.missionSensitivity*confidenceWeight,0,1);
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

  return{
    teamId:mission.teamId,
    missionId:mission.id,
    reportId:report.id,
    subjectId:report.subjectId,
    sourceActorId:report.sourceActorId,
    evidenceType:"communicated_contact_report",
    state,
    previousState:null,
    missionRelevance:relevanceLabel(relevanceScore),
    relevanceScore,
    reportConfidence:confidence,
    reportAge:age,
    approximatePosition:{...report.approximatePosition},
    spatial:{...spatial},
    identity:report.identity??"unknown",
    factionId:report.factionId??null,
    intent:"unknown",
    interferenceKind:mission.interference?.kind??null,
    interferenceLabel:mission.interference?.label??null,
    reason,
    response:null,
    assessedAt:now,
    lastEvidenceAt:report.reportedAt??now,
    forgetAfter:mission.forgetAfter
  };
}
