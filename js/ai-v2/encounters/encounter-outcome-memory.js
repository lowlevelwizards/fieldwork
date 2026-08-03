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
      const key=`${procedure.teamId}:${procedure.startedAt}`;
      if(this.completedProcedures.has(key))continue;
      if(procedure.procedureId==="casualty_recovery"&&procedure.phase?.id==="recovery_complete"){
        const casualtyRole=procedure.roles.find(role=>role.roleId==="aid_provider");
        const teamActors=(game?.actors??[]).filter(actor=>actor.teamId===procedure.teamId);
        const casualty=teamActors.find(actor=>["critical","unconscious","serious"].includes(actor.medical?.condition)&&actor.id!==casualtyRole?.actorId)??null;
        const assessment=casualty?game?.wounds?.getAssessment?.(casualty):null;
        if(!casualty||!assessment||assessment.bleeding>.05)continue;
        this.completedProcedures.add(key);
        const outcome=this.#remember({
          teamId:procedure.teamId,
          counterpartTeamId:null,
          kind:"casualty_stabilized",
          label:"Casualty stabilized",
          summary:`${casualty.name} was recovered to protected ground and immediate bleeding was controlled. Further evacuation or care is still required.`,
          facts:["friendly casualty reported","casualty assessed","casualty moved to protected ground","uncontrolled bleeding stopped","casualty remains impaired"],
          evidence:[procedure.procedureId,casualty.id],
          subjectId:casualty.id,
          immediateHazardResolved:true,
          missionResolved:false,
          followUp:"evacuation_required",
          subjectCondition:"stable_critical",
          mobility:"non_ambulatory",
          now
        });
        casualty.aiV2RecoveryMemory={...outcome,facts:[...outcome.facts],evidence:[...outcome.evidence]};
        continue;
      }
      if(procedure.procedureId!=="break_contact_quietly"||procedure.phase?.id!=="withdrawal_complete")continue;

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
        immediateHazardResolved:true,
        missionResolved:true,
        followUp:null,
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
        immediateHazardResolved:true,
        missionResolved:true,
        followUp:null,
        now
      });
      teamProcedures?.notifyEvent?.({teamId:sourceTeamId,event:"departure_confirmed",now,data:{outcomeId:sourceOutcome?.id??null}});
    }
  }

  #remember({
    teamId,
    counterpartTeamId,
    kind,
    label,
    summary,
    facts,
    evidence,
    subjectId=null,
    immediateHazardResolved=false,
    missionResolved=false,
    followUp=null,
    subjectCondition=null,
    mobility=null,
    now
  }){
    const outcome={
      id:`v2_outcome_${nextOutcomeSequence++}`,
      teamId,
      counterpartTeamId,
      kind,
      label,
      summary,
      facts:[...facts],
      evidence:[...evidence],
      subjectId,
      createdAt:now,
      violent:false,
      immediateHazardResolved:Boolean(immediateHazardResolved),
      missionResolved:Boolean(missionResolved),
      followUp,
      subjectCondition,
      mobility,
      status:missionResolved?"resolved":immediateHazardResolved?"ongoing_obligation":"active",
      resolved:Boolean(missionResolved)
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
