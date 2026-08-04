const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

function contribution(id,label,value,weight){
  const normalized=clamp(value);
  return{id,label,value:normalized,weight,contribution:normalized*weight};
}

const BREAK_CONTACT_UNDER_FIRE=Object.freeze({
  id:"break_contact_under_fire",
  label:"Break Contact Under Fire",
  summary:"Use bounded protective fire and staged movement to preserve the team and reach the authored withdrawal route.",
  evaluate({ledger,mission,encounter}={}){
    const eligible=Boolean(
      ledger&&
      mission?.withdrawalPlan?.exitPoint&&
      encounter?.subjectKind!=="friendly_casualty"&&
      (encounter?.state==="relevant"||encounter?.state==="potentially_incompatible")&&
      encounter?.intent==="hostile"
    );
    if(!eligible)return null;
    const contributions=[
      contribution("hostile_evidence","physical hostile evidence is present",ledger.hostileEvidence,.34),
      contribution("preservation","breaking contact preserves the team",ledger.teamPreservation,.22),
      contribution("exit_options","an authored safety route is available",ledger.exitOptions,.16),
      contribution("mobility","the team can move in sequence",ledger.mobilityOrientation,.12),
      contribution("time_pressure","incoming fire creates immediate time pressure",Math.max(ledger.timePressure,.9),.12),
      contribution("position_failure","the open position is not sustainable",1-ledger.positionSecurity,.08),
      contribution("resource_cost","protective fire consumes ammunition",1-ledger.resourceConservation,.04)
    ];
    const bias=clamp(ledger.responseBias?.break_contact_under_fire??0,-.35,.35);
    const score=clamp(.2+contributions.reduce((sum,item)=>sum+item.contribution,0)+bias);
    return{
      id:this.id,
      label:this.label,
      summary:this.summary,
      score,
      bias,
      contributions,
      reason:`A hostile shot has made ${ledger.positionLabel} unsustainable; ${mission.withdrawalPlan.label} allows bounded protective fire and staged movement instead of an open-ended fight.`,
      eligible:true
    };
  }
});

export const AI_V2_2_0P_RESPONSE_OPTIONS=Object.freeze([BREAK_CONTACT_UNDER_FIRE]);
