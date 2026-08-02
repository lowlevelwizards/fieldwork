let nextOutcomeSequence=1;

function cloneOutcome(outcome){
  return outcome?{
    ...outcome,
    facts:[...(outcome.facts??[])],
    evidence:[...(outcome.evidence??[])]
  }:null;
}

export class EncounterOutcomeMemory{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.byTeam=new Map();
    this.completedProcedures=new Set();
  }

  update({game,teamProcedures,teamEncounters,heardCommunications,now=0}={}){
    for(const procedure of teamProcedures?.summary?.()??[]){
      if(procedure.procedureId!=="break_contact_quietly"||procedure.phase?.id!=="withdrawal_complete")continue;
      const key=`${procedure.teamId}:${procedure.startedAt}`;
      if(this.completedProcedures.has(key))continue;

      const incoming=heardCommunications?.getLatestForTeam?.(procedure.teamId)??null;
      const sourceTeamId=incoming?.sourceTeamId??null;
      const sourceEncounter=sourceTeamId?teamEncounters?.getBestTeamHypothesis?.(sourceTeamId):null;
      if(!incoming||!sourceTeamId||!sourceEncounter?.departureObservedAfterWarning)continue;

      this.completedProcedures.add(key);
      this.#remember({
        teamId:procedure.teamId,
        counterpartTeamId:sourceTeamId,
        kind:"withdrew_without_reply",
        label:"Withdrew without violence",
        summary:"A directed stop-and-identify warning indicated likely detection. The team withdrew without replying or revealing its identity.",
        facts:["warning heard","no reply sent","team withdrew","no hostile act observed"],
        evidence:[incoming.id,procedure.procedureId],
        now
      });
      const sourceOutcome=this.#remember({
        teamId:sourceTeamId,
        counterpartTeamId:procedure.teamId,
        kind:"contact_departed_after_warning",
        label:"Contact departed after warning",
        summary:"The reported armed group moved away from the monitored approach after the warning. No reply or hostile act was observed.",
        facts:["warning issued","departure observed","no reply heard","no hostile act observed"],
        evidence:[incoming.id,sourceEncounter.reportId],
        now
      });
      teamProcedures?.notifyEvent?.({teamId:sourceTeamId,event:"departure_confirmed",now,data:{outcomeId:sourceOutcome?.id??null}});
    }
  }

  #remember({teamId,counterpartTeamId,kind,label,summary,facts,evidence,now}){
    const outcome={
      id:`v2_outcome_${nextOutcomeSequence++}`,
      teamId,counterpartTeamId,kind,label,summary,
      facts:[...facts],evidence:[...evidence],
      createdAt:now,
      violent:false,
      resolved:true
    };
    if(!this.byTeam.has(teamId))this.byTeam.set(teamId,[]);
    this.byTeam.get(teamId).unshift(outcome);
    this.decisionLog?.record?.({type:"encounter_outcome_remembered",time:now,teamId,data:{...outcome,facts:[...outcome.facts],evidence:[...outcome.evidence]}});
    return cloneOutcome(outcome);
  }

  getLatest(teamId){return cloneOutcome(this.byTeam.get(teamId)?.[0]??null);}
  count(){let total=0;for(const records of this.byTeam.values())total+=records.length;return total;}
  summary(){return[...this.byTeam.entries()].map(([teamId,outcomes])=>({teamId,outcomes:outcomes.map(cloneOutcome)}));}
}
