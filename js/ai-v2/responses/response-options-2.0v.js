const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

function contribution(id,label,value,weight){
  const normalized=clamp(value);
  return{id,label,value:normalized,weight,contribution:normalized*weight};
}

const PRESS_OPERATION=Object.freeze({
  id:"press_operation",
  label:"Press Operation",
  summary:"Continue the assigned approach despite a non-hostile warning while preserving readiness to break contact if physical danger appears.",
  evaluate({ledger,encounter}={}){
    const eligible=Boolean(
      ledger&&
      encounter?.subjectKind!=="friendly_casualty"&&
      (encounter?.state==="relevant"||encounter?.state==="potentially_incompatible")&&
      ledger.warningHeard>0&&
      ledger.hostileEvidence<=0
    );
    if(!eligible)return null;
    const contributions=[
      contribution("mission_value","the unresolved operation remains valuable",ledger.missionValue,.24),
      contribution("time_pressure","delay risks losing operational value",ledger.timePressure,.18),
      contribution("mobility","the team can continue moving coherently",ledger.mobilityOrientation,.14),
      contribution("exit_options","a break-contact route remains available",ledger.exitOptions,.10),
      contribution("preservation","the team still values preservation",ledger.teamPreservation,.10),
      contribution("non_hostile","no physical hostile evidence exists yet",1-ledger.hostileEvidence,.10),
      contribution("warning","the warning is understood but not automatically decisive",ledger.warningHeard,.08),
      contribution("uncertainty","unknown intent keeps the decision reversible",ledger.informationUncertainty,.05)
    ];
    const bias=clamp(ledger.responseBias?.press_operation??0,-.35,.35);
    const score=clamp(.08+contributions.reduce((sum,item)=>sum+item.contribution,0)+bias);
    return{
      id:this.id,label:this.label,summary:this.summary,score,bias,contributions,
      reason:`The operation remains urgent and physically viable; the warning alone does not outweigh the mission while a withdrawal route is still available if the situation becomes hostile.`,
      eligible:true
    };
  }
});

const DEMONSTRATIVE_FIRE=Object.freeze({
  id:"demonstrative_fire",
  label:"Demonstrative Fire",
  summary:"Fire one deliberately offset warning round after a clear boundary warning is ignored, then stop and reassess.",
  evaluate({ledger,encounter}={}){
    const eligible=Boolean(
      ledger&&
      encounter?.subjectKind!=="friendly_casualty"&&
      (encounter?.state==="relevant"||encounter?.state==="potentially_incompatible")&&
      ledger.warningIgnored>0&&
      ledger.boundaryEnforcementAvailable>0&&
      ledger.hostileEvidence<=0
    );
    if(!eligible)return null;
    const contributions=[
      contribution("ignored_warning","the warned group continued after the compliance window",ledger.warningIgnored,.34),
      contribution("boundary","the contact remains inside the active worksite boundary",ledger.boundaryInside,.16),
      contribution("mission_value","the protected technical responsibility remains important",ledger.missionValue,.13),
      contribution("security","the operation favors visible boundary control",ledger.securityOrientation,.11),
      contribution("activity","continued movement provides current evidence",ledger.activityEvidence,.08),
      contribution("reversible","one offset round is more bounded than direct engagement",ledger.reversibleCommunicationValue,.08),
      contribution("position","the team can enforce from a sustainable position",ledger.positionSecurity,.06),
      contribution("resource_cost","the response consumes one finite round",1-ledger.resourceConservation,.03)
    ];
    const bias=clamp(ledger.responseBias?.demonstrative_fire??0,-.35,.35);
    const score=clamp(.15+contributions.reduce((sum,item)=>sum+item.contribution,0)+bias);
    return{
      id:this.id,label:this.label,summary:this.summary,score,bias,contributions,
      reason:`The boundary warning was delivered and the contact continued inside the worksite after the compliance window; one deliberately offset round can create unmistakable evidence without direct targeting or open-ended fire.`,
      eligible:true
    };
  }
});

export const AI_V2_2_0V_RESPONSE_OPTIONS=Object.freeze([PRESS_OPERATION,DEMONSTRATIVE_FIRE]);
