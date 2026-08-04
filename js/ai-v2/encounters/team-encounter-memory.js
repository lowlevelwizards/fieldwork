import { assessEncounterHypothesis, assessFriendlyCasualtyHypothesis, ENCOUNTER_STATES } from "./encounter-assessment.js";

export class TeamEncounterMemory{
  constructor({decisionLog=null}={}){
    this.decisionLog=decisionLog;
    this.byTeam=new Map();
  }

  update({game=null,missions,teamKnowledge,casualtyKnowledge=null,heardCommunications=null,teamProcedures=null,now=0}={}){
    const touched=new Set();
    for(const mission of missions?.summary?.()??[]){
      const reports=[
        ...(mission.problemKind==="friendly_casualty"?[]:(teamKnowledge?.getTeamContacts?.(mission.teamId)??[])).map(report=>({report,kind:"contact"})),
        ...(casualtyKnowledge?.getTeamCasualties?.(mission.teamId)??[]).map(report=>({report,kind:"casualty"}))
      ];
      if(!this.byTeam.has(mission.teamId))this.byTeam.set(mission.teamId,new Map());
      const hypotheses=this.byTeam.get(mission.teamId);
      const activeProcedure=teamProcedures?.get?.(mission.teamId)??null;
      const boundEncounterProcedure=Boolean(
        mission.liveOperation&&activeProcedure?.subjectId&&[
          "protective_breakaway","demonstrative_boundary_fire","challenge_unknown_contact","monitor_departure"
        ].includes(activeProcedure.procedureId)&&activeProcedure.phase?.id!=="contact_broken"&&activeProcedure.phase?.id!=="boundary_restored"
      );

      const heardWarning=heardCommunications?.getLatestForTeam?.(mission.teamId)??null;
      const outgoingWarning=heardCommunications?.getLatestOutgoing?.(mission.teamId)??null;
      for(const entry of reports){
        const report=entry.report;
        const actorBackedSubject=String(report.subjectId??"").startsWith("living_actor_");
        if(mission.liveOperation&&entry.kind==="contact"&&actorBackedSubject&&!(game?.actors??[]).some(actor=>actor.id===report.subjectId)){
          hypotheses.delete(report.subjectId);
          touched.add(`${mission.teamId}:${report.subjectId}`);
          continue;
        }
        let assessed=entry.kind==="casualty"
          ?assessFriendlyCasualtyHypothesis({mission,report,now})
          :assessEncounterHypothesis({mission,report,heardWarning,outgoingWarning,now});
        if(!assessed)continue;
        if(assessed.subjectKind==="friendly_casualty"){
          const casualty=(game?.actors??[]).find(actor=>actor.id===assessed.subjectId&&actor.teamId===mission.teamId)??null;
          const assessment=casualty&&!casualty.aiV2Evacuated?game?.wounds?.getAssessment?.(casualty)??null:null;
          if(casualty&&assessment){
            const condition=assessment.condition??casualty.medical?.condition??"unknown";
            const needsCare=Boolean(assessment.dead||assessment.unconscious||["wounded","serious","critical","unconscious","dead"].includes(condition)||Number(assessment.bleeding??0)>.05);
            if(needsCare){
              const immediate=Boolean(assessment.dead||assessment.unconscious||["serious","critical","unconscious","dead"].includes(condition));
              assessed.state=immediate?ENCOUNTER_STATES.POTENTIALLY_INCOMPATIBLE:ENCOUNTER_STATES.RELEVANT;
              assessed.reportConfidence=Math.max(82,assessed.reportConfidence??0);
              assessed.reportAge=0;
              assessed.lastEvidenceAt=now;
              assessed.relevanceScore=immediate?1:Math.max(.62,assessed.relevanceScore??0);
              assessed.approximatePosition={x:casualty.x,y:casualty.y};
              assessed.reason=assessment.dead
                ?`${casualty.name??"A teammate"} has died in the field; the team must stop treating the original mission as normal work.`
                :`${casualty.name??"A teammate"} remains physically present with a ${condition} condition; the shared casualty obligation remains current.`;
              assessed.casualty={
                ...(assessed.casualty??{}),condition,
                mobility:assessment.unconscious||assessment.dead?"unable_to_self_move":assessed.casualty?.mobility??"requires_assisted_movement",
                urgency:immediate?"urgent":"care_required",
                bleeding:Number(assessment.bleeding??0),blood:Number(assessment.blood??100),shock:Number(assessment.shock??0),
                assessed:true,immediateDanger:immediate,treatmentNeed:assessment.need?{...assessment.need}:null,dead:Boolean(assessment.dead)
              };
            }
          }
        }
        if(boundEncounterProcedure&&assessed.subjectId===activeProcedure.subjectId){
          assessed.state=ENCOUNTER_STATES.POTENTIALLY_INCOMPATIBLE;
          assessed.relevanceScore=1;
          assessed.reportConfidence=Math.max(88,assessed.reportConfidence??0);
          assessed.reportAge=0;
          assessed.lastEvidenceAt=now;
          assessed.reason=`${activeProcedure.label} still owns the team's governing response; the encounter remains current until the procedure reaches a causal completion condition.`;
        }
        const key=assessed.subjectId;
        const existing=hypotheses.get(key);
        assessed.previousState=existing?.state??ENCOUNTER_STATES.NONE;
        assessed.createdAt=existing?.createdAt??now;
        if(mission.liveOperation){
          // A route adjustment inside a worksite is not a completed departure.
          // Live encounters require current evidence that the contact has actually
          // crossed outside the mission boundary before monitoring departure.
          assessed.departureObserved=Boolean(assessed.departureObserved&&!assessed.spatial?.inside);
          assessed.departureObservedAfterWarning=Boolean(assessed.departureObservedAfterWarning&&!assessed.spatial?.inside);
          assessed.departureFirstObservedAt=assessed.departureObserved?(existing?.departureFirstObservedAt??now):null;
          assessed.departureAfterWarningFirstObservedAt=assessed.departureObservedAfterWarning?(existing?.departureAfterWarningFirstObservedAt??now):null;
        }else{
          assessed.departureObserved=Boolean(existing?.departureObserved||assessed.departureObserved);
          assessed.departureFirstObservedAt=existing?.departureFirstObservedAt??(assessed.departureObserved?now:null);
          assessed.departureObservedAfterWarning=Boolean(existing?.departureObservedAfterWarning||assessed.departureObservedAfterWarning);
          assessed.departureAfterWarningFirstObservedAt=existing?.departureAfterWarningFirstObservedAt??(assessed.departureObservedAfterWarning?now:null);
        }
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

        if(boundEncounterProcedure&&subjectId===activeProcedure.subjectId){
          const previous=hypothesis.state;
          hypothesis.state=ENCOUNTER_STATES.POTENTIALLY_INCOMPATIBLE;
          hypothesis.previousState=previous;
          hypothesis.relevanceScore=1;
          hypothesis.reportConfidence=Math.max(88,hypothesis.reportConfidence??0);
          hypothesis.reportAge=0;
          hypothesis.assessedAt=now;
          hypothesis.lastEvidenceAt=now;
          hypothesis.reason=`${activeProcedure.label} still owns the team's governing response; the encounter remains current until the procedure reaches a causal completion condition.`;
          touched.add(key);
          if(previous!==hypothesis.state)this.#record("team_encounter_state_changed",hypothesis,now,{from:previous,to:hypothesis.state,reason:"governing_procedure_still_active"});
          continue;
        }

        // A reported teammate does not become an abstract stale memory while
        // their body is still physically present and visibly needs care. The
        // original report establishes shared knowledge; current medical state
        // then keeps the obligation grounded until safe transfer, death, or
        // physical removal resolves it.
        if(hypothesis.subjectKind==="friendly_casualty"){
          const casualty=(game?.actors??[]).find(actor=>actor.id===subjectId&&actor.teamId===mission.teamId)??null;
          if(casualty&&!casualty.aiV2Evacuated){
            const assessment=game?.wounds?.getAssessment?.(casualty)??null;
            const condition=assessment?.condition??casualty.medical?.condition??"unknown";
            const needsCare=Boolean(
              assessment?.dead||assessment?.unconscious||
              ["wounded","serious","critical","unconscious","dead"].includes(condition)||
              Number(assessment?.bleeding??casualty.medical?.bleedingRate??0)>.05
            );
            if(needsCare){
              const previous=hypothesis.state;
              const immediate=Boolean(assessment?.dead||assessment?.unconscious||["serious","critical","unconscious","dead"].includes(condition));
              hypothesis.state=immediate?ENCOUNTER_STATES.POTENTIALLY_INCOMPATIBLE:ENCOUNTER_STATES.RELEVANT;
              hypothesis.previousState=previous;
              hypothesis.approximatePosition={x:casualty.x,y:casualty.y};
              hypothesis.reportConfidence=Math.max(82,hypothesis.reportConfidence??0);
              hypothesis.reportAge=0;
              hypothesis.assessedAt=now;
              hypothesis.lastEvidenceAt=now;
              hypothesis.relevanceScore=immediate?1:Math.max(.62,hypothesis.relevanceScore??0);
              hypothesis.reason=assessment?.dead
                ?`${casualty.name??"A teammate"} has died in the field; the team must stop treating the original mission as normal work.`
                :`${casualty.name??"A teammate"} remains physically present with a ${condition} condition; the shared casualty obligation remains current.`;
              hypothesis.casualty={
                ...(hypothesis.casualty??{}),
                condition,
                mobility:assessment?.unconscious||assessment?.dead?"unable_to_self_move":hypothesis.casualty?.mobility??"requires_assisted_movement",
                urgency:immediate?"urgent":"care_required",
                bleeding:Number(assessment?.bleeding??casualty.medical?.bleedingRate??0),
                blood:Number(assessment?.blood??casualty.medical?.blood??100),
                shock:Number(assessment?.shock??casualty.medical?.shock??0),
                assessed:Boolean(assessment),
                immediateDanger:immediate,
                treatmentNeed:assessment?.need?{...assessment.need}:hypothesis.casualty?.treatmentNeed??null,
                dead:Boolean(assessment?.dead)
              };
              touched.add(key);
              if(previous!==hypothesis.state)this.#record("team_encounter_state_changed",hypothesis,now,{from:previous,to:hypothesis.state,reason:"physical_casualty_still_present"});
              continue;
            }
          }
        }

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
      // Physical hostile evidence must outrank an older uncertain visual
      // contact even when that visual report has higher confidence. This is
      // a priority of evidence, not an identity merge: the hostile source may
      // remain an anonymous threat subject.
      if(Boolean(b.physicalHostileEvidence)!==Boolean(a.physicalHostileEvidence))return b.physicalHostileEvidence?1:-1;
      const hostileRank=h=>h.intent==="hostile"||h.intentHypothesis?.id==="hostile"||h.activity==="firing"?1:0;
      if(hostileRank(b)!==hostileRank(a))return hostileRank(b)-hostileRank(a);
      const rank={potentially_incompatible:4,relevant:3,possible:2,stale:1,none:0};
      if((rank[b.state]??0)!==(rank[a.state]??0))return(rank[b.state]??0)-(rank[a.state]??0);
      if(Boolean(b.departureObservedAfterWarning)!==Boolean(a.departureObservedAfterWarning))return b.departureObservedAfterWarning?1:-1;
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
        casualty:hypothesis.casualty?{...hypothesis.casualty,treatmentNeed:hypothesis.casualty.treatmentNeed?{...hypothesis.casualty.treatmentNeed}:null}:null,
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
