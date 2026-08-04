const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
const term=(id,label,value,weight)=>({id,label,value:clamp(value),weight,contribution:clamp(value)*weight});

function option({id,label,summary,eligible,terms,reason,base=.08}){
  return Object.freeze({id,label,summary,evaluate({ledger,encounter}={}){
    if(!ledger||!eligible({ledger,encounter}))return null;
    const contributions=terms(ledger);
    const bias=clamp(ledger.responseBias?.[id]??0,-.35,.35);
    return{id,label,summary,score:clamp(base+contributions.reduce((sum,item)=>sum+item.contribution,0)+bias),bias,contributions,reason:reason(ledger),eligible:true};
  }});
}

const COORDINATE_LOCALLY=option({
  id:"coordinate_locally",label:"Coordinate Locally",summary:"Recognize compatible field work, divide local responsibilities, and retain separate operation authority.",base:.22,
  eligible:({ledger})=>ledger.nonHostileRelationship>0&&ledger.compatibleOperation>0&&ledger.hostileEvidence<=0,
  terms:ledger=>[
    term("recognized_team","the other group is understood as a field team",ledger.recognizedTeam,.18),
    term("same_faction","shared faction identity supports immediate trust",ledger.sameFaction,.24),
    term("compatible_work","their visible operation is compatible",ledger.compatibleOperation,.22),
    term("mission_value","coordination preserves useful work",ledger.missionValue,.12),
    term("resource_conservation","shared security avoids duplicated effort",ledger.resourceConservation,.08),
    term("certainty","the team has enough evidence to coordinate",ledger.informationCertainty,.08)
  ],
  reason:ledger=>`The nearby team is recognized as non-hostile and its visible work is compatible; local coordination can divide security or assistance without merging either operation.`
});

const PASS_AROUND=option({
  id:"pass_around",label:"Pass Around",summary:"Acknowledge the other team, preserve spacing, and continue the assigned route without challenging the area.",base:.18,
  eligible:({ledger})=>ledger.recognizedTeam>0&&ledger.nonHostileRelationship>0&&ledger.hostileEvidence<=0,
  terms:ledger=>[
    term("recognized_team","the other group is recognized",ledger.recognizedTeam,.18),
    term("relationship","the relationship is non-hostile",ledger.nonHostileRelationship,.22),
    term("mobility","the team can move around without abandoning the mission",ledger.mobilityOrientation,.18),
    term("preservation","deconfliction protects both teams",ledger.teamPreservation,.12),
    term("mission_value","the original mission remains governing",ledger.missionValue,.12),
    term("exit_options","space exists to pass or yield",ledger.exitOptions,.08)
  ],
  reason:ledger=>`The contact is a recognized non-hostile field team; preserving spacing and passing around it is more useful than issuing a warning or abandoning the mission.`
});

const AID_OTHER_TEAM=option({
  id:"aid_other_team",label:"Offer Bounded Aid",summary:"Provide limited emergency care or security while the distressed team keeps ownership of its operation and evacuation.",base:.24,
  eligible:({ledger})=>ledger.distressObserved>0&&ledger.nonHostileRelationship>0&&ledger.hostileEvidence<=0,
  terms:ledger=>[
    term("distress","the other team is visibly in distress",ledger.distressObserved,.28),
    term("care","the mission culture values care under pressure",ledger.careOrientation,.18),
    term("preservation","limited aid preserves field capacity",ledger.teamPreservation,.16),
    term("recognized_team","the distressed group is understood as a team",ledger.recognizedTeam,.12),
    term("time_available","the current mission can tolerate a bounded interruption",1-ledger.timePressure,.12),
    term("reversible","aid can end once immediate danger is controlled",ledger.reversibleCommunicationValue,.06)
  ],
  reason:ledger=>`A recognized non-hostile team is in visible distress; one bounded aid responsibility can address immediate danger while both operations remain separate.`
});

export const AI_V2_2_4_RESPONSE_OPTIONS=Object.freeze([AID_OTHER_TEAM,COORDINATE_LOCALLY,PASS_AROUND]);
