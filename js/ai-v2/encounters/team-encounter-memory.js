import { assessEncounterHypothesis, ENCOUNTER_STATES } from "./encounter-assessment.js?v=20k-boundaries-challenge-warning-20260802";

export class TeamEncounterMemory{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.byTeam=new Map();
  }

  update({missions,teamKnowledge,heardCommunications=null,now=0}={}){
    const touched=new Set();
    for(const mission of missions?.summary?.()??[]){
      const reports=teamKnowledge?.getTeamContacts?.(mission.teamId)??[];
      if(!this.byTeam.has(mission.teamId))this.byTeam.set(mission.teamId,new Map());
      const hypotheses=this.byTeam.get(mission.teamId);

      const heardWarning=heardCommunications?.getLatestForTeam?.(mission.teamId)??null;
      const outgoingWarning=heardCommunications?.getLatestOutgoing?.(mission.teamId)??null;
      for(const report of reports){
        const assessed=assessEncounterHypothesis({mission,report,heardWarning,outgoingWarning,now});
        if(!assessed)continue;
        const key=assessed.subjectId;
        const existing=hypotheses.get(key);
        assessed.previousState=existing?.state??ENCOUNTER_STATES.NONE;
        assessed.createdAt=existing?.createdAt??now;
        hypotheses.set(key,assessed);
        touched.add(`${mission.teamId}:${key}`);

        if(!existing){
          this.#record("team_encounter_hypothesis_created",assessed,now);
        }else if(existing.state!==assessed.state){
          this.#record("team_encounter_state_changed",assessed,now,{from:existing.state,to:assessed.state});
        }
      }

      for(const [subjectId,hypothesis] of hypotheses){
        const key=`${mission.teamId}:${subjectId}`;
        if(touched.has(key))continue;
        const age=Math.max(0,now-(hypothesis.lastEvidenceAt??hypothesis.assessedAt??now));
        if(age>=hypothesis.forgetAfter){
          hypotheses.delete(subjectId);
          this.#record("team_encounter_hypothesis_forgotten",hypothesis,now);
          continue;
        }
        if(hypothesis.state!==ENCOUNTER_STATES.STALE){
          const previous=hypothesis.state;
          hypothesis.state=ENCOUNTER_STATES.STALE;
          hypothesis.previousState=previous;
          hypothesis.reason="The supporting team report is no longer available; only a stale encounter memory remains.";
          hypothesis.reportConfidence=0;
          hypothesis.reportAge=age;
          hypothesis.assessedAt=now;
          this.#record("team_encounter_state_changed",hypothesis,now,{from:previous,to:ENCOUNTER_STATES.STALE});
        }else{
          hypothesis.reportAge=age;
          hypothesis.assessedAt=now;
        }
      }

      if(!hypotheses.size)this.byTeam.delete(mission.teamId);
    }
  }

  getTeamHypotheses(teamId){
    return [...(this.byTeam.get(teamId)?.values()??[])].sort((a,b)=>{
      const rank={potentially_incompatible:4,relevant:3,possible:2,stale:1,none:0};
      if((rank[b.state]??0)!==(rank[a.state]??0))return(rank[b.state]??0)-(rank[a.state]??0);
      return b.relevanceScore-a.relevanceScore;
    });
  }

  getBestTeamHypothesis(teamId){
    return this.getTeamHypotheses(teamId)[0]??null;
  }

  get(teamId,subjectId){
    return this.byTeam.get(teamId)?.get(subjectId)??null;
  }

  count(){
    let total=0;
    for(const hypotheses of this.byTeam.values())total+=hypotheses.size;
    return total;
  }

  summary(){
    return [...this.byTeam.entries()].map(([teamId,hypotheses])=>({
      teamId,
      hypotheses:[...hypotheses.values()].map(hypothesis=>({
        ...hypothesis,
        approximatePosition:{...hypothesis.approximatePosition},
        previousApproximatePosition:hypothesis.previousApproximatePosition?{...hypothesis.previousApproximatePosition}:null,
        intentHypothesis:hypothesis.intentHypothesis?{...hypothesis.intentHypothesis}:null,
        heardWarning:hypothesis.heardWarning?{...hypothesis.heardWarning,targetPoint:hypothesis.heardWarning.targetPoint?{...hypothesis.heardWarning.targetPoint}:null,approximateSourcePosition:hypothesis.heardWarning.approximateSourcePosition?{...hypothesis.heardWarning.approximateSourcePosition}:null,recipientIds:[...(hypothesis.heardWarning.recipientIds??[])]}:null,
        outgoingWarning:hypothesis.outgoingWarning?{...hypothesis.outgoingWarning,targetPoint:hypothesis.outgoingWarning.targetPoint?{...hypothesis.outgoingWarning.targetPoint}:null,approximateSourcePosition:hypothesis.outgoingWarning.approximateSourcePosition?{...hypothesis.outgoingWarning.approximateSourcePosition}:null,recipientIds:[...(hypothesis.outgoingWarning.recipientIds??[])]}:null,
        spatial:{...hypothesis.spatial}
      }))
    }));
  }

  #record(type,hypothesis,now,data={}){
    this.decisionLog?.record?.({
      type,
      time:now,
      teamId:hypothesis.teamId,
      data:{
        subjectId:hypothesis.subjectId,
        missionId:hypothesis.missionId,
        reportId:hypothesis.reportId,
        state:hypothesis.state,
        relevanceScore:Math.round(hypothesis.relevanceScore*100),
        reportConfidence:Math.round(hypothesis.reportConfidence),
        reportKind:hypothesis.reportKind,
        activity:hypothesis.activity,
        activityRevision:hypothesis.activityRevision,
        intent:hypothesis.intent,
        reason:hypothesis.reason,
        ...data
      }
    });
  }
}
