const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

function contribution(id,label,value,weight){
  const normalized=clamp(value);
  return{id,label,value:normalized,weight,contribution:normalized*weight};
}

const HOLD_DEFENSIVELY=Object.freeze({
  id:"hold_defensively",
  label:"Hold Defensively",
  summary:"Translate the known hostile direction into distinct persistent cover responsibilities instead of abandoning a mission-critical position.",
  evaluate({ledger,mission,encounter}={}){
    const eligible=Boolean(
      ledger&&mission?.defensivePlan&&
      encounter?.subjectKind!=="friendly_casualty"&&
      (encounter?.state==="relevant"||encounter?.state==="potentially_incompatible")&&
      encounter?.intent==="hostile"
    );
    if(!eligible)return null;
    const contributions=[
      contribution("hostile_evidence","physical hostile evidence establishes a threat direction",ledger.hostileEvidence,.24),
      contribution("mission_value","the defended responsibility remains important",ledger.missionValue,.20),
      contribution("position_security","nearby terrain can support a defensible posture",ledger.positionSecurity,.16),
      contribution("security_orientation","the mission favors maintaining control",ledger.securityOrientation,.14),
      contribution("team_preservation","directional cover protects the team",ledger.teamPreservation,.12),
      contribution("resource_conservation","holding avoids an open-ended exchange",ledger.resourceConservation,.06),
      contribution("limited_exit_value","leaving is not the strongest mission option",1-ledger.exitOptions,.06),
      contribution("time_pressure","the team must settle into useful positions promptly",ledger.timePressure,.06)
    ];
    const bias=clamp(ledger.responseBias?.hold_defensively??0,-.35,.35);
    const score=clamp(.18+contributions.reduce((sum,item)=>sum+item.contribution,0)+bias);
    return{
      id:this.id,
      label:this.label,
      summary:this.summary,
      score,
      bias,
      contributions,
      reason:`Hostile evidence threatens ${ledger.positionLabel}, but the mission remains valuable and ${mission.defensivePlan.label} offers distinct directional cover slots that can be occupied without crowding or continuous repositioning.`,
      eligible:true
    };
  }
});

export const AI_V2_2_0Q_RESPONSE_OPTIONS=Object.freeze([HOLD_DEFENSIVELY]);
